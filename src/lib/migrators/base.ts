import { TOOL_CONFIGS } from '../config'
import { getToolPath } from '../path'
import { Logger } from '../utils/logger'
import type { ToolKey, ConfigType } from '../config'
import type { MigrateOptions, MigrationStats } from './types'

/**
 * 迁移器抽象基类
 */
export abstract class BaseMigrator {
  protected sourceDir: string
  protected targetTools: ToolKey[]
  protected options: MigrateOptions
  protected configType: ConfigType

  constructor(
    sourceDir: string,
    targetTools: ToolKey[],
    options: MigrateOptions,
    configType: ConfigType
  ) {
    this.sourceDir = sourceDir
    this.targetTools = targetTools
    this.options = options
    this.configType = configType
  }

  /**
   * 执行迁移的主入口 (模板方法)
   */
  async migrate(): Promise<MigrationStats> {
    const results: MigrationStats = { success: 0, skipped: 0, error: 0, errors: [] }

    for (const tool of this.targetTools) {
      try {
        const targetDir = this.getTargetDir(tool)
        const toolStats = await this.migrateForTool(tool, targetDir)
        
        results.success += toolStats.success
        results.skipped += toolStats.skipped
        results.error += toolStats.error
        results.errors.push(...toolStats.errors)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.error++
        results.errors.push({ 
          file: `Tool: ${tool}, Type: ${this.configType}`, 
          error: errorMessage 
        })
      }
    }

    return results
  }

  /**
   * 为单个工具执行迁移 (由子类实现)
   */
  protected abstract migrateForTool(tool: ToolKey, targetDir: string): Promise<MigrationStats>

  /**
   * 获取目标路径
   */
  protected getTargetDir(tool: ToolKey): string {
    return getToolPath(
      tool,
      this.configType,
      this.options.isProject,
      this.options.projectDir
    )
  }

  /**
   * 辅助方法：合并统计结果
   */
  protected sumStats(base: MigrationStats, addition: MigrationStats): void {
    base.success += addition.success
    base.skipped += addition.skipped
    base.error += addition.error
    base.errors.push(...addition.errors)
  }
}
