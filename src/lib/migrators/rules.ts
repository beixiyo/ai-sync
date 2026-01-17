/**
 * Rules 迁移器
 */

import { copyDirectory } from '../utils/file'
import { mergeRules } from '../converters/rules-merger'
import { getToolPath } from '../path'
import { TOOL_CONFIGS } from '../config'
import chalk from 'chalk'
import type { CopyDirectoryResults } from '../utils/file'
import type { ToolKey } from '../config'
import type { MigrateOptions } from './commands'

/**
 * Rules 迁移器类
 */
export class RulesMigrator {
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
      const toolConfig = TOOL_CONFIGS[tool]

      if (toolConfig.rules.merge) {
        await this.migrateWithMerge(tool, results)
      } else {
        await this.migrateDirect(tool, results)
      }
    }

    return results
  }

  /**
   * 直接迁移
   */
  private async migrateDirect(tool: ToolKey, results: CopyDirectoryResults): Promise<void> {
    const targetDir = getToolPath(tool, 'rules', this.options.isProject, this.options.projectDir)
    const stats = await copyDirectory(this.sourceDir, targetDir, this.options.autoOverwrite)
    results.success += stats.success
    results.skipped += stats.skipped
    results.error += stats.error
    results.errors.push(...stats.errors)
  }

  /**
   * 带合并的迁移
   */
  private async migrateWithMerge(tool: ToolKey, results: CopyDirectoryResults): Promise<void> {
    const targetFile = getToolPath(tool, 'rules', this.options.isProject, this.options.projectDir)

    try {
      await mergeRules(this.sourceDir, targetFile)
      console.log(chalk.green(`✓ 合并 Rules → ${tool}`))
      results.success++
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(chalk.red(`✗ 合并 Rules 失败 (${tool})`), errorMessage)
      results.error++
      results.errors.push({ file: targetFile, error: errorMessage })
    }
  }
}