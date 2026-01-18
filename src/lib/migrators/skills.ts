/**
 * Skills 迁移器
 */

import type { ToolConfig, ToolKey } from '../config'
import type { MigrateOptions, MigrationStats } from './types'
import { dirname, join } from 'node:path'
import { copyDirectory, ensureDirectoryExists, fileExists, getMarkdownFiles, readFile, writeFile } from '../utils/file'
import { BaseMigrator } from './base'

/**
 * Skills 迁移器类
 */
export class SkillsMigrator extends BaseMigrator {
  constructor(sourceDir: string, targetTools: ToolKey[], options: MigrateOptions, tools: Record<ToolKey, ToolConfig>) {
    super(sourceDir, targetTools, options, 'skills', tools)
  }

  /**
   * 为单个工具执行迁移
   */
  protected async migrateForTool(tool: ToolKey, targetDir: string): Promise<MigrationStats> {
    const results: MigrationStats = { success: 0, skipped: 0, error: 0, errors: [] }
    const toolConfig = this.tools[tool]

    /** 如果有自定义 transform 函数，使用自定义逻辑 */
    if (toolConfig?.skills?.transform) {
      await this.migrateWithTransform(targetDir, results, tool)
    }
    else {
      const stats = await copyDirectory(this.sourceDir, targetDir, this.options.autoOverwrite)
      this.sumStats(results, stats)
    }

    return results
  }

  /**
   * 带自定义转换的迁移
   */
  private async migrateWithTransform(
    targetDir: string,
    results: MigrationStats,
    tool: ToolKey,
  ): Promise<void> {
    const transform = this.tools[tool]?.skills?.transform
    if (!transform)
      return

    const files = await getMarkdownFiles(this.sourceDir)

    for (const file of files) {
      const sourcePath = join(this.sourceDir, file)
      const targetPath = join(targetDir, file)

      if (await fileExists(targetPath) && !this.options.autoOverwrite) {
        results.skipped++
        continue
      }

      try {
        const content = await readFile(sourcePath, 'utf-8')
        const transformed = await transform(content, file)
        await ensureDirectoryExists(dirname(targetPath))
        await writeFile(targetPath, transformed, 'utf-8')
        results.success++
      }
      catch (error) {
        const errorMessage = error instanceof Error
          ? error.message
          : 'Unknown error'
        results.error++
        results.errors.push({ file, error: errorMessage })
      }
    }
  }
}
