/**
 * 文件工具函数
 */

import type { Dirent } from 'node:fs'
import type { MigrationError } from './logger'
import { access, chmod, constants, copyFile, lstat, mkdir, readdir, readFile, readlink, realpath, rename, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import TOML from '@iarna/toml'
import { parse as parseJSONC, stringify as stringifyJSONC } from 'comment-json'

export { readFile, writeFile }

/**
 * 确保目录存在
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await mkdir(dirPath, { recursive: true })
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code !== 'EEXIST') {
      throw error
    }
  }
}

/**
 * 检查文件是否存在
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK)
    return true
  }
  catch {
    return false
  }
}

/**
 * 检查目录是否存在
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await stat(dirPath)
    return stats.isDirectory()
  }
  catch {
    return false
  }
}

/**
 * 安全复制文件
 */
export async function copyFileSafe(
  sourcePath: string,
  targetPath: string,
  autoOverwrite: boolean = false,
): Promise<CopyResult> {
  if (await fileExists(targetPath) && !autoOverwrite) {
    return { success: false, skipped: true, error: null }
  }

  try {
    /**
     * 即将写入时若目标是符号链接（含断链）一律先解除，避免沿链接写穿到别处的真实文件：
     * 断链在 fileExists 下视为不存在，但 open(O_CREAT) 会跟随它在别处重建文件
     */
    const targetStat = await lstat(targetPath).catch(() => null)
    if (targetStat?.isSymbolicLink()) {
      await rm(targetPath, { force: true })
    }

    await ensureDirectoryExists(dirname(targetPath))
    await copyFile(sourcePath, targetPath)
    return { success: true, skipped: false, error: null }
  }
  catch (error) {
    return {
      success: false,
      skipped: false,
      error: error instanceof Error
        ? error
        : new Error(String(error)),
    }
  }
}

/**
 * 复制目录
 */
export async function copyDirectory(
  sourceDir: string,
  targetDir: string,
  autoOverwrite: boolean = false,
): Promise<CopyDirectoryResults> {
  const results: CopyDirectoryResults = { success: 0, skipped: 0, error: 0, errors: [] }

  try {
    const entries = await readdir(sourceDir, { withFileTypes: true })

    for (const entry of entries) {
      const sourcePath = join(sourceDir, entry.name)
      const targetPath = join(targetDir, entry.name)

      if (entry.isDirectory()) {
        /**
         * 覆盖模式下目标若是符号链接（如软链接模式遗留、指向旧源目录），先解除再递归，
         * 避免沿目录链接把新内容写进链接指向的真实目录
         */
        if (autoOverwrite) {
          const dirStat = await lstat(targetPath).catch(() => null)
          if (dirStat?.isSymbolicLink()) {
            await rm(targetPath, { force: true })
          }
        }

        const subdirResults = await copyDirectory(sourcePath, targetPath, autoOverwrite)
        results.success += subdirResults.success
        results.skipped += subdirResults.skipped
        results.error += subdirResults.error
        results.errors.push(...subdirResults.errors)
      }
      else if (entry.isFile()) {
        const result = await copyFileSafe(sourcePath, targetPath, autoOverwrite)
        if (result.success) {
          results.success++
        }
        else if (result.skipped) {
          results.skipped++
        }
        else {
          results.error++
          results.errors.push({ file: entry.name, error: result.error?.message || 'Unknown error' })
        }
      }
    }
  }
  catch (error) {
    /** 如果目录不存在，视为跳过，不记为错误 (If directory not found, treat as skipped, not an error) */
    if (error instanceof Error && (error as any).code === 'ENOENT') {
      return results
    }
    results.error++
    results.errors.push({
      file: sourceDir,
      error: error instanceof Error
        ? error.message
        : 'Unknown error',
    })
  }

  return results
}

/**
 * 以软链接方式同步目录（Skills 软链接模式）
 *
 * 将 `sourceDir` 下每个顶级条目在 `targetDir` 中创建为指向源的符号链接：
 * - 目标已是正确指向源的链接 → 跳过（幂等）
 * - 目标存在同名复制文件/目录或指向他处的链接 → 安全替换（先建临时链接，成功后才替换旧内容）
 * - 目标中存在指向源目录内、但源已删除的失效链接 → 自动清理（源目录整体不存在时同样清理）
 * - 目标中与源无关的真实条目 → 保留不动
 * - 目标与源指向同一物理目录（互为别名）或存在包含关系 → 整体跳过，避免误删真实源
 * - 交叉布局（源条目本身是指向目标目录内部的链接，如 skills CLI 的安装布局）→ 跳过该条目，
 *   目标处的同名内容就是唯一真实数据，绝不能当作旧副本替换或删除
 *
 * 链接统一使用绝对路径；Windows 上目录使用 junction（无需管理员权限）
 */
export async function symlinkDirectory(
  sourceDir: string,
  targetDir: string,
): Promise<CopyDirectoryResults> {
  const results: CopyDirectoryResults = { success: 0, skipped: 0, error: 0, errors: [] }
  const absoluteSourceDir = resolve(sourceDir)

  let entries: Dirent[]
  try {
    entries = await readdir(absoluteSourceDir, { withFileTypes: true })
  }
  catch (error) {
    /** 源目录不存在时仍清理目标中的遗留链接，不记为错误 */
    if (error instanceof Error && (error as any).code === 'ENOENT') {
      await cleanupStaleSymlinks(targetDir, absoluteSourceDir, results)
      return results
    }
    results.error++
    results.errors.push({
      file: sourceDir,
      error: error instanceof Error
        ? error.message
        : 'Unknown error',
    })
    return results
  }

  /**
   * 目标与源指向同一物理目录（如整个目标目录已链接到源），或二者存在包含关系时跳过，
   * 避免把链接建进源自身、误删真实源内容
   */
  const realSourceDir = await realpath(absoluteSourceDir).catch(() => absoluteSourceDir)
  const realTargetDir = await realpath(targetDir).catch(() => null)
  if (
    realTargetDir && (
      realTargetDir === realSourceDir
      || isInsideDirectory(realTargetDir, realSourceDir)
      || isInsideDirectory(realSourceDir, realTargetDir)
    )
  ) {
    return results
  }

  /**
   * 目标尚不存在时 realpath 拿不到完整物理路径：解析最近存在的祖先物理路径并拼上剩余段，
   * 防止目标经父目录别名（如 /alias → 源内真实目录）绕过词法检查落进源内部；
   * 目标已存在的情形上面的物理路径比较已覆盖
   */
  if (!realTargetDir) {
    const suffixParts: string[] = [basename(targetDir)]
    let probe = dirname(resolve(targetDir))
    while (!(await fileExists(probe))) {
      suffixParts.unshift(basename(probe))
      probe = dirname(probe)
    }
    const realProbe = await realpath(probe).catch(() => probe)
    const projectedTarget = resolve(realProbe, ...suffixParts)
    if (
      projectedTarget === realSourceDir
      || isInsideDirectory(projectedTarget, realSourceDir)
    ) {
      return results
    }
  }

  try {
    await ensureDirectoryExists(targetDir)
  }
  catch (error) {
    results.error++
    results.errors.push({
      file: targetDir,
      error: error instanceof Error
        ? error.message
        : 'Unknown error',
    })
    return results
  }

  /** 交叉布局防护用：创建后重新解析目标物理路径，并复核包含关系（双保险） */
  const resolvedTargetDir = await realpath(targetDir).catch(() => targetDir)
  if (
    resolvedTargetDir === realSourceDir
    || isInsideDirectory(resolvedTargetDir, realSourceDir)
  ) {
    return results
  }

  for (const entry of entries) {
    const sourcePath = resolve(absoluteSourceDir, entry.name)
    const targetPath = join(targetDir, entry.name)

    try {
      /**
       * 交叉布局防护（如 skills CLI：真实文件在目标目录，源条目是指向它的链接）：
       * 源条目的真实位置落在目标目录内时，目标处的同名内容就是唯一真实数据，
       * 跳过以避免形成循环链接、或把真实文件当作旧副本删除；
       * 源条目是断链（realpath 失败）时同样跳过，不做无意义甚至危险的替换
       */
      const realSourceEntry = await realpath(sourcePath).catch(() => null)
      if (
        !realSourceEntry
        || realSourceEntry === resolvedTargetDir
        || isInsideDirectory(realSourceEntry, resolvedTargetDir)
      ) {
        results.skipped++
        continue
      }

      const created = await replaceWithSymlink(sourcePath, targetPath, entry.isDirectory())
      if (created) {
        results.success++
      }
      else {
        results.skipped++
      }
    }
    catch (error) {
      results.error++
      results.errors.push({
        file: entry.name,
        error: error instanceof Error
          ? error.message
          : 'Unknown error',
      })
    }
  }

  await cleanupStaleSymlinks(targetDir, absoluteSourceDir, results)

  return results
}

/**
 * 确保目标路径是指向 `sourcePath` 的符号链接
 *
 * 先在临时路径创建链接，创建成功后才替换旧内容（改名旧内容 → 新链接就位 → 删除旧内容），
 * 避免先删后建在链接创建失败（如 Windows 无符号链接权限）时造成旧内容永久丢失
 * 临时/备份路径带唯一后缀，不触碰无关的同名原生条目，也不受历史残留影响
 *
 * 返回 `false` 表示目标已是正确的链接（未改动）
 */
async function replaceWithSymlink(
  sourcePath: string,
  targetPath: string,
  isDirectory: boolean,
): Promise<boolean> {
  const targetStat = await lstat(targetPath).catch(() => null)

  if (targetStat?.isSymbolicLink()) {
    const existing = await readlink(targetPath)
    if (resolve(dirname(targetPath), existing) === sourcePath) {
      return false
    }
  }

  const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const tmpLinkPath = `${targetPath}.ai-sync-tmp-${uniqueSuffix}`
  const backupPath = `${targetPath}.ai-sync-bak-${uniqueSuffix}`

  /** POSIX 上 type 参数被忽略；Windows 上目录使用 junction 无需管理员权限 */
  await symlink(
    sourcePath,
    tmpLinkPath,
    isDirectory
      ? 'junction'
      : 'file',
  )

  try {
    if (targetStat) {
      await rename(targetPath, backupPath)
    }
    await rename(tmpLinkPath, targetPath)
  }
  catch (error) {
    /** 回滚：清理临时链接的失败不得阻断旧内容恢复 */
    await rm(tmpLinkPath, { recursive: true, force: true }).catch(() => {})

    let backupKept = false
    if (targetStat && !(await fileExists(targetPath))) {
      /** 恢复失败时保留备份，并在错误信息中说明位置，不能静默吞掉 */
      backupKept = !(await rename(backupPath, targetPath).then(
        () => true,
        () => false,
      ))
    }

    const reason = error instanceof Error
      ? error.message
      : 'Unknown error'
    throw new Error(
      backupKept
        ? `${reason}（旧内容已保留备份: ${backupPath}）`
        : reason,
    )
  }

  await rm(backupPath, { recursive: true, force: true })
  return true
}

/**
 * 清理目标目录中指向源目录内部、但源已不存在的失效链接
 *
 * 仅处理失效符号链接，不动与源无关的真实文件/目录
 */
async function cleanupStaleSymlinks(
  targetDir: string,
  absoluteSourceDir: string,
  results: CopyDirectoryResults,
): Promise<void> {
  let targetEntries: Dirent[]
  try {
    targetEntries = await readdir(targetDir, { withFileTypes: true })
  }
  catch {
    return
  }

  for (const entry of targetEntries) {
    if (!entry.isSymbolicLink())
      continue

    const targetPath = join(targetDir, entry.name)
    try {
      const resolved = resolve(targetDir, await readlink(targetPath))
      if (!isInsideDirectory(resolved, absoluteSourceDir))
        continue

      try {
        /** 源条目仍存在，链接有效 */
        await stat(resolved)
        continue
      }
      catch (error) {
        /** 仅明确的 ENOENT 视为源已删除；权限等异常保守保留链接 */
        if (error instanceof Error && (error as any).code !== 'ENOENT')
          continue
      }

      await rm(targetPath, { force: true })
    }
    catch (error) {
      results.error++
      results.errors.push({
        file: entry.name,
        error: error instanceof Error
          ? error.message
          : 'Unknown error',
      })
    }
  }
}

function isInsideDirectory(path: string, dir: string): boolean {
  const rel = relative(dir, path)
  /** `..` / `..${sep}` 前缀才是越界，不能误伤 `..foo` 这类合法同名前缀条目 */
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

/**
 * 解除目标目录中指向源目录内部的符号链接（软链接模式的遗留产物）
 *
 * 用于从软链接模式切回复制/转换模式：只删除链接本身、不动真实文件，
 * 确保后续复制/转换产出真实副本，而不是沿链接写穿到源
 * 链接目标按物理路径（realpath）与源比较，覆盖源路径以别名形式传入的场景
 * 解除失败会如实上报，由调用方决定是否继续（继续写入会有写穿风险）
 */
export interface UnlinkSymlinksResult {
  /** 解除的链接数量 */
  unlinked: number
  /** 解除失败的条目及错误 */
  errors: MigrationError[]
}

export async function unlinkSymlinksInto(targetDir: string, sourceDir: string): Promise<UnlinkSymlinksResult> {
  const result: UnlinkSymlinksResult = { unlinked: 0, errors: [] }

  let entries: Dirent[]
  try {
    entries = await readdir(targetDir, { withFileTypes: true })
  }
  catch {
    /** 目标目录不存在等情形视为无事可做，不算错误 */
    return result
  }

  /** 优先物理路径比较（覆盖别名）；realpath 失败时退回词法路径 */
  const absoluteSourceDir = resolve(sourceDir)
  const realSourceDir = await realpath(absoluteSourceDir).catch(() => absoluteSourceDir)

  for (const entry of entries) {
    if (!entry.isSymbolicLink())
      continue

    const targetPath = join(targetDir, entry.name)
    try {
      /**
       * 源条目本身是符号链接（如 skills CLI 交叉布局）时不解除：
       * 复制/转换不处理链接型源条目，保留目标链接才能让 skill 继续可达，
       * 避免切回复制模式后目标内容静默消失
       */
      const sourceEntryStat = await lstat(join(realSourceDir, entry.name)).catch(() => null)
      if (sourceEntryStat?.isSymbolicLink())
        continue

      /** 词法路径与物理路径双重比较，覆盖链接目标经别名指向源的情形 */
      const resolved = resolve(targetDir, await readlink(targetPath))
      const resolvedReal = await realpath(resolved).catch(() => null)
      if (
        !isInsideDirectory(resolved, realSourceDir)
        && !isInsideDirectory(resolved, absoluteSourceDir)
        && !(resolvedReal && (
          isInsideDirectory(resolvedReal, realSourceDir)
          || isInsideDirectory(resolvedReal, absoluteSourceDir)
        ))
      ) {
        continue
      }

      await rm(targetPath, { force: true })
      result.unlinked++
    }
    catch (error) {
      result.errors.push({
        file: entry.name,
        error: error instanceof Error
          ? error.message
          : 'Unknown error',
      })
    }
  }

  return result
}

/**
 * 获取 Markdown 文件列表
 */
export async function getMarkdownFiles(dirPath: string): Promise<string[]> {
  const files: string[] = []
  try {
    const entries = await readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdc'))) {
        files.push(entry.name)
      }
    }
  }
  catch (error) {
    /** 忽略目录不存在的错误 (Ignore directory not found error) */
    if (error instanceof Error && (error as any).code === 'ENOENT') {
      return []
    }
    console.error(
      `fail to read dir: ${dirPath}`,
      error instanceof Error
        ? error.message
        : 'Unknown error',
    )
  }

  return files
}

/**
 * 读取 JSON 文件（支持 JSONC 格式）
 *
 * 使用 `comment-json` 解析，注释会以 symbol 形式挂在返回对象上，
 * 配合 `writeJSONFile` 可在写回时保留未改动部分的注释
 */
export async function readJSONFile<T = unknown>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf-8')
  return parseJSONC(content) as T
}

/**
 * 写入 JSON 文件
 *
 * 若 `data` 由 `readJSONFile` 解析得来，其上携带的注释会被一并写回
 */
export async function writeJSONFile(filePath: string, data: unknown): Promise<void> {
  await ensureDirectoryExists(dirname(filePath))
  await writeFile(filePath, stringifyJSONC(data, null, 2), 'utf-8')
}

/**
 * 读取 TOML 文件
 */
export async function readTOMLFile<T = unknown>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf-8')
  return TOML.parse(content) as unknown as T
}

/**
 * 写入 TOML 文件
 *
 * 目标已存在时尽量保留原文中「未改动」顶层配置的注释与格式：
 * 只把发生变化的顶层「表类型」键（如迁移时整体替换的 `mcp_servers`）剥离后用
 * `@iarna/toml` 重新生成，其余文本逐字保留。任何无法安全处理的情况都回退到完整
 * 序列化，确保输出始终是合法 TOML（正确性优先于注释保留）
 */
export async function writeTOMLFile(filePath: string, data: any): Promise<void> {
  await ensureDirectoryExists(dirname(filePath))

  let output: string | undefined
  if (await fileExists(filePath)) {
    const existing = await readFile(filePath, 'utf-8')
    output = mergeTOMLPreservingComments(existing, data)
  }

  await writeFile(filePath, output ?? TOML.stringify(data), 'utf-8')
}

/**
 * 在保留注释的前提下，将 `data` 合并进已存在的 TOML 原文
 *
 * 返回 `undefined` 表示无法安全保留（调用方应回退到完整序列化）
 */
function mergeTOMLPreservingComments(original: string, data: any): string | undefined {
  let old: Record<string, any>
  try {
    old = TOML.parse(original) as Record<string, any>
  }
  catch {
    /** 原文无法解析，交给调用方完整重写 */
    return undefined
  }

  /** 发生变化或新增的顶层键 */
  const changedKeys = Object.keys(data).filter(key => !isDeepEqual(data[key], old[key]))
  /** 原文中已被删除的顶层键 */
  const removedKeys = Object.keys(old).filter(key => !(key in data))
  const dirtyKeys = [...new Set([...changedKeys, ...removedKeys])]

  if (dirtyKeys.length === 0) {
    return original.endsWith('\n')
      ? original
      : `${original}\n`
  }

  /**
   * 仅当所有变动键都是「表类型」（对象）时才做注释保留式合并：
   * 这类键在 TOML 中以 `[key]` / `[key.sub]` section 形式存在，可安全按行剥离
   * 若涉及根级标量/数组的增删改，按行剥离不可靠，直接回退
   */
  const allChangedKeysAreTables = changedKeys.every(key => isPlainObject(data[key]))
  const allRemovedKeysAreTables = removedKeys.every(key => isPlainObject(old[key]))
  if (!allChangedKeysAreTables || !allRemovedKeysAreTables)
    return undefined

  /** 从原文剥离这些顶层表的所有 section，保留其余文本（含注释） */
  const head = stripTopLevelTables(original, dirtyKeys)

  /** 重新生成变动键（新增/修改），删除键则不再写出 */
  const regenerated: Record<string, any> = {}
  for (const key of changedKeys) regenerated[key] = data[key]

  const tail = Object.keys(regenerated).length > 0
    ? TOML.stringify(regenerated).trimEnd()
    : ''

  return `${[head, tail].filter(Boolean).join('\n\n')}\n`
}

/**
 * 从 TOML 原文中剥离指定顶层表的所有 section（`[name]` / `[name.x]` / `[[name]]`），
 * 保留其余所有行
 */
function stripTopLevelTables(text: string, tableNames: string[]): string {
  const targets = new Set(tableNames)
  const out: string[] = []
  let skipping = false

  for (const line of text.split('\n')) {
    const header = line.match(/^\s*\[\[?\s*([^\]]+?)\s*\]\]?\s*$/)
    if (header) {
      const firstSegment = header[1].split('.')[0].trim().replace(/^["']|["']$/g, '')
      skipping = targets.has(firstSegment)
    }
    if (!skipping)
      out.push(line)
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b)
    return true
  if (typeof a !== typeof b)
    return false
  if (typeof a !== 'object' || a === null || b === null)
    return false
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * 设置可执行权限
 */
export async function setExecutablePermission(filePath: string): Promise<void> {
  if (process.platform !== 'win32') {
    await chmod(filePath, 0o755)
  }
}

export interface CopyResult {
  success: boolean
  skipped: boolean
  error: Error | null
}

export interface CopyDirectoryResults {
  success: number
  skipped: number
  error: number
  errors: MigrationError[]
}

/**
 * 移除目录及其内容
 */
export async function removeDirectory(dirPath: string): Promise<void> {
  try {
    await rm(dirPath, { recursive: true, force: true })
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
      throw error
    }
  }
}
