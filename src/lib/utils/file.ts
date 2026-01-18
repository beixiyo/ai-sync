/**
 * 文件工具函数
 */

import type { MigrationError } from './logger'
import { access, chmod, constants, copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import TOML from '@iarna/toml'

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
    return { success: false, skipped: false, error: error instanceof Error ? error : new Error(String(error)) }
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
    results.error++
    results.errors.push({ file: sourceDir, error: error instanceof Error ? error.message : 'Unknown error' })
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
    console.error(`读取目录失败: ${dirPath}`, error instanceof Error ? error.message : 'Unknown error')
  }

  return files
}

/**
 * 读取 JSON 文件
 */
export async function readJSONFile<T = unknown>(filePath: string): Promise<T> {
  const content = await readFile(filePath, 'utf-8')
  return JSON.parse(content) as T
}

/**
 * 写入 JSON 文件
 */
export async function writeJSONFile(filePath: string, data: unknown): Promise<void> {
  await ensureDirectoryExists(dirname(filePath))
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
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
 */
export async function writeTOMLFile(filePath: string, data: any): Promise<void> {
  await ensureDirectoryExists(dirname(filePath))
  await writeFile(filePath, TOML.stringify(data), 'utf-8')
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
