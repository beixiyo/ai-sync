/**
 * 文件工具函数
 */

import type { MigrationError } from './logger'
import { access, chmod, constants, copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
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
    await ensureDirectoryExists(dirname(targetPath))
    await copyFile(sourcePath, targetPath)
    return { success: true, skipped: false, error: null }
  }
  catch (error) {
    return { success: false, skipped: false, error: error instanceof Error
      ? error
      : new Error(String(error)) }
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
    results.errors.push({ file: sourceDir, error: error instanceof Error
      ? error.message
      : 'Unknown error' })
  }

  return results
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
    console.error(`读取目录失败: ${dirPath}`, error instanceof Error
      ? error.message
      : 'Unknown error')
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
   * 这类键在 TOML 中以 `[key]` / `[key.sub]` section 形式存在，可安全按行剥离。
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
