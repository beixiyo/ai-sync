/**
 * Settings 迁移器（包含 Hooks 和 Permissions）
 */

import type { ToolConfig, ToolKey } from '../config'
import type { MigrateOptions, MigrationStats } from './types'
import { dirname } from 'node:path'
import chalk from 'chalk'
import { deepMerge } from '../utils/deepMerge'
import { fileExists, readJSONFile, writeJSONFile } from '../utils/file'
import { BaseMigrator } from './base'

/**
 * Settings 迁移器类
 */
export class SettingsMigrator extends BaseMigrator {
  constructor(sourceFile: string, targetTools: ToolKey[], options: MigrateOptions, tools: Record<ToolKey, ToolConfig>) {
    super(sourceFile, targetTools, options, 'settings', tools)
  }

  async migrate(): Promise<MigrationStats> {
    if (!(await fileExists(this.sourceDir)))
      return { success: 0, skipped: 0, error: 0, errors: [] }
    return super.migrate()
  }

  protected async migrateForTool(tool: ToolKey, targetPath: string): Promise<MigrationStats> {
    const results: MigrationStats = { success: 0, skipped: 0, error: 0, errors: [] }
    const toolConfig = this.tools[tool]

    if (!toolConfig.settings) {
      return results
    }

    try {
      const sourceContent = await readJSONFile<any>(this.sourceDir)
      let targetConfig: any = {}

      // 读取目标配置（如果存在）
      if (await fileExists(targetPath)) {
        targetConfig = await readJSONFile(targetPath)
      }

      // 根据配置决定是合并还是覆盖
      if (toolConfig.settings.merge && !this.options.autoOverwrite) {
        // 深度合并：保留目标文件的现有配置
        targetConfig = deepMerge(targetConfig, sourceContent)
      }
      else if (this.options.autoOverwrite) {
        // 覆盖模式：替换关键配置项
        for (const key in sourceContent) {
          targetConfig[key] = sourceContent[key]
        }
      }
      else {
        // 默认：深度合并
        targetConfig = deepMerge(targetConfig, sourceContent)
      }

      await writeJSONFile(targetPath, targetConfig)
      results.success++
      console.log(chalk.green(`✓ Settings 迁移完成: ${tool}`))
    }
    catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : '迁移失败'
      results.error++
      results.errors.push({ file: targetPath, error: errorMessage })
      console.error(chalk.red(`✗ Settings 迁移失败 (${tool}): ${errorMessage}`))
    }

    return results
  }
}
