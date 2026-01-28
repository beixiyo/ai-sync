import type { ConfigType, ToolConfig, ToolKey } from '../config'
import type { MigrateOptions, MigrationStats } from './types'
import { resolveTargetPath } from '../path'
import { logger } from '../utils/logger'

/**
 * 迁移器抽象基类
 */
export abstract class BaseMigrator {
  protected sourceDir: string
  protected targetTools: ToolKey[]
  protected options: MigrateOptions
  protected configType: ConfigType
  protected tools: Record<ToolKey, ToolConfig>
  protected logger = logger

  constructor(
    sourceDir: string,
    targetTools: ToolKey[],
    options: MigrateOptions,
    configType: ConfigType,
    tools: Record<ToolKey, ToolConfig>,
  ) {
    this.sourceDir = sourceDir
    this.targetTools = targetTools
    this.options = options
    this.configType = configType
    this.tools = tools
  }

  /**
   * 执行迁移的主入口 (模板方法)
   */
  async migrate(): Promise<MigrationStats> {
    const results: MigrationStats = { success: 0, skipped: 0, error: 0, errors: [] }

    for (const tool of this.targetTools) {
      try {
        const targetDir = await this.getTargetDir(tool)
        const toolStats = await this.migrateForTool(tool, targetDir)

        results.success += toolStats.success
        results.skipped += toolStats.skipped
        results.error += toolStats.error
        results.errors.push(...toolStats.errors)
      }
      catch (error) {
        const errorMessage = error instanceof Error
          ? error.message
          : 'Unknown error'
        results.error++
        results.errors.push({
          file: `Tool: ${tool}, Type: ${this.configType}`,
          error: errorMessage,
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
  protected async getTargetDir(tool: ToolKey): Promise<string> {
    return resolveTargetPath(
      tool,
      this.configType,
    )
  }

  /**
   * 辅助方法：报告成功
   */
  protected reportSuccess(message: string): void {
    this.logger.success(`✓ ${message}`)
  }

  /**
   * 辅助方法：报告错误
   */
  protected reportError(message: string, error?: string): void {
    this.logger.error(`✗ ${message}${error ? `: ${error}` : ''}`)
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
