/**
 * Hooks 迁移器
 */

import { copyDirectory, type CopyDirectoryResults } from '../utils/file'
import { convertHooksForClaude } from '../converters/hooks-converter'
import { getToolPath } from '../path'
import { TOOL_CONFIGS } from '../config'
import { join } from 'path'
import chalk from 'chalk'
import type { ToolKey } from '../config'
import type { MigrateOptions } from './commands'

/**
 * Hooks 迁移器类
 */
export class HooksMigrator {
  private sourceDir: string
  private sourceConfigFile: string
  private targetTools: ToolKey[]
  private options: MigrateOptions

  constructor(sourceDir: string, sourceConfigFile: string, targetTools: ToolKey[], options: MigrateOptions) {
    this.sourceDir = sourceDir
    this.sourceConfigFile = sourceConfigFile
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

      if (toolConfig.hooks.supported === false) {
        continue
      }

      if (toolConfig.hooks.convert) {
        await this.migrateWithConversion(tool, results)
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
    const targetDir = getToolPath(tool, 'hooks', this.options.isProject, this.options.projectDir)
    const stats = await copyDirectory(this.sourceDir, targetDir, this.options.autoOverwrite)
    results.success += stats.success
    results.skipped += stats.skipped
    results.error += stats.error
    results.errors.push(...stats.errors)

    const targetConfigFile = join(targetDir, 'hooks.json')
    try {
      await copyDirectory(this.sourceConfigFile, targetConfigFile, this.options.autoOverwrite)
      results.success++
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      results.error++
      results.errors.push({ file: targetConfigFile, error: errorMessage })
    }
  }

  /**
   * 带转换的迁移
   */
  private async migrateWithConversion(tool: ToolKey, results: CopyDirectoryResults): Promise<void> {
    const targetFile = getToolPath(tool, 'hooks', this.options.isProject, this.options.projectDir)

    try {
      await convertHooksForClaude(this.sourceDir, this.sourceConfigFile, targetFile)
      console.log(chalk.green(`✓ 转换 Hooks → ${tool}`))
      results.success++
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(chalk.red(`✗ 转换 Hooks 失败 (${tool})`), errorMessage)
      results.error++
      results.errors.push({ file: targetFile, error: errorMessage })
    }
  }
}