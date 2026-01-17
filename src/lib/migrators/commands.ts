/**
 * Commands 迁移器
 */

import { copyDirectory } from '../utils/file'
import { convertMarkdownToTOML } from '../converters/markdown-to-toml'
import { getToolPath } from '../path'
import { getMarkdownFiles } from '../utils/file'
import { join } from 'path'
import chalk from 'chalk'
import type { CopyDirectoryResults } from '../utils/file'
import type { ToolKey } from '../config'

/**
 * Commands 迁移器类
 */
export class CommandsMigrator {
  private sourceDir: string
  private targetTools: ToolKey[]
  private options: MigrateOptions

  constructor(sourceDir: string, targetTools: ToolKey[], options: MigrateOptions) {
    this.sourceDir = sourceDir
    this.targetTools = targetTools
    this.options = options
  }

  /**
   * 执行迁移
   */
  async migrate(): Promise<CopyDirectoryResults> {
    const results: CopyDirectoryResults = { success: 0, skipped: 0, error: 0, errors: [] }

    for (const tool of this.targetTools) {
      const targetDir = getToolPath(tool, 'commands', this.options.isProject, this.options.projectDir)

      if (['cursor', 'claude', 'opencode'].includes(tool)) {
        const stats = await copyDirectory(this.sourceDir, targetDir, this.options.autoOverwrite)
        results.success += stats.success
        results.skipped += stats.skipped
        results.error += stats.error
        results.errors.push(...stats.errors)
      } else if (['gemini', 'iflow'].includes(tool)) {
        await this.migrateWithConversion(targetDir, results, tool)
      }
    }

    return results
  }

  /**
   * 带转换的迁移
   */
  private async migrateWithConversion(
    targetDir: string,
    results: CopyDirectoryResults,
    tool: ToolKey
  ): Promise<void> {
    const files = await getMarkdownFiles(this.sourceDir)

    for (const file of files) {
      const sourcePath = join(this.sourceDir, file)
      const targetPath = join(targetDir, file.replace('.md', '.toml'))

      try {
        await convertMarkdownToTOML(sourcePath, targetPath)
        console.log(chalk.green(`✓ 转换: ${file} → ${file.replace('.md', '.toml')} (${tool})`))
        results.success++
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(chalk.red(`✗ 转换失败: ${file}`), errorMessage)
        results.error++
        results.errors.push({ file, error: errorMessage })
      }
    }
  }
}

export interface MigrateOptions {
  isProject: boolean
  projectDir: string
  autoOverwrite: boolean
}