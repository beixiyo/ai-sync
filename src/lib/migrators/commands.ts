/**
 * Commands 迁移器
 */

import type { ToolConfig, ToolKey } from '../config'
import type { MigrateOptions, MigrationStats } from './types'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import chalk from 'chalk'
import { convertMarkdownToTOML } from '../converters/markdown-to-toml'
import { copyDirectory, getMarkdownFiles, readFile, writeFile } from '../utils/file'
import { BaseMigrator } from './base'

/**
 * Commands 迁移器类
 */
export class CommandsMigrator extends BaseMigrator {
  constructor(sourceDir: string, targetTools: ToolKey[], options: MigrateOptions, tools: Record<ToolKey, ToolConfig>) {
    super(sourceDir, targetTools, options, 'commands', tools)
  }

  /**
   * 为单个工具执行迁移
   */
  protected async migrateForTool(tool: ToolKey, targetDir: string): Promise<MigrationStats> {
    const results: MigrationStats = { success: 0, skipped: 0, error: 0, errors: [] }
    const toolConfig = this.tools[tool]

    /** 如果有自定义 transform 函数，使用自定义逻辑 */
    if (toolConfig?.commands?.transform) {
      await this.migrateWithCustomTransform(targetDir, results, tool)
      return results
    }

    if (['gemini', 'iflow'].includes(tool)) {
      await this.migrateWithConversion(targetDir, results, tool)
    }
    else {
      /** 默认直接复制 (cursor, claude, opencode 等) */
      const stats = await copyDirectory(this.sourceDir, targetDir, this.options.autoOverwrite)
      this.sumStats(results, stats)
    }

    return results
  }

  /**
   * 使用自定义转换逻辑
   */
  private async migrateWithCustomTransform(
    targetDir: string,
    results: MigrationStats,
    tool: ToolKey,
  ): Promise<void> {
    const transform = this.tools[tool]?.commands?.transform
    if (!transform)
      return

    const files = await getMarkdownFiles(this.sourceDir)

    for (const file of files) {
      const sourcePath = join(this.sourceDir, file)
      const targetPath = join(targetDir, file)

      try {
        const content = await readFile(sourcePath, 'utf-8')
        const transformed = await transform(content, file)

        if (!existsSync(dirname(targetPath))) {
          await mkdir(dirname(targetPath), { recursive: true })
        }

        await writeFile(targetPath, transformed, 'utf-8')
        console.log(chalk.green(`✓ 自定义转换: ${file} (${tool}) (Custom transform: ${file} (${tool}))`))
        results.success++
      }
      catch (error) {
        const errorMessage = error instanceof Error
          ? error.message
          : 'Unknown error'
        console.error(chalk.red(`✗ 自定义转换失败: ${file} (Custom transform failed: ${file})`), errorMessage)
        results.error++
        results.errors.push({ file, error: errorMessage })
      }
    }
  }

  /**
   * 带转换的迁移 (MD -> TOML)
   */
  private async migrateWithConversion(
    targetDir: string,
    results: MigrationStats,
    tool: ToolKey,
  ): Promise<void> {
    const files = await getMarkdownFiles(this.sourceDir)

    for (const file of files) {
      const sourcePath = join(this.sourceDir, file)
      const targetPath = join(targetDir, file.replace('.md', '.toml'))

      try {
        await convertMarkdownToTOML(sourcePath, targetPath)
        console.log(chalk.green(`✓ 转换: ${file} → ${file.replace('.md', '.toml')} (${tool}) (Transform: ${file} → ${file.replace('.md', '.toml')} (${tool}))`))
        results.success++
      }
      catch (error) {
        const errorMessage = error instanceof Error
          ? error.message
          : 'Unknown error'
        console.error(chalk.red(`✗ 转换失败: ${file} (Transform failed: ${file})`), errorMessage)
        results.error++
        results.errors.push({ file, error: errorMessage })
      }
    }
  }
}
