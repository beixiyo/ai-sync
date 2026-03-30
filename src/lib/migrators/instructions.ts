/**
 * Instructions 迁移器
 * 将 CLAUDE.md 同步为各工具的全局指令文件（GEMINI.md / AGENTS.md / CODEBUDDY.md）
 */

import type { ToolConfig, ToolKey } from '../config'
import type { MigrateOptions, MigrationStats } from './types'
import { dirname } from 'node:path'
import { ensureDirectoryExists, fileExists, readFile, writeFile } from '../utils/file'
import { BaseMigrator } from './base'

/**
 * Instructions 迁移器类
 */
export class InstructionsMigrator extends BaseMigrator {
  constructor(sourceDir: string, targetTools: ToolKey[], options: MigrateOptions, tools: Record<ToolKey, ToolConfig>) {
    super(sourceDir, targetTools, options, 'instructions', tools)
  }

  /**
   * 为单个工具执行迁移（单文件复制）
   */
  protected async migrateForTool(tool: ToolKey, targetPath: string): Promise<MigrationStats> {
    const results: MigrationStats = { success: 0, skipped: 0, error: 0, errors: [] }
    const toolConfig = this.tools[tool]

    try {
      if (!await fileExists(this.sourceDir)) {
        this.reportError(`源文件不存在 (Source file not found): ${this.sourceDir}`)
        results.error++
        results.errors.push({ file: this.sourceDir, error: 'Source file not found' })
        return results
      }

      if (await fileExists(targetPath) && !this.options.autoOverwrite) {
        this.logger.warn(`⚠ 跳过 Instructions (${tool}): 文件已存在 (Skip: file exists)`)
        results.skipped++
        return results
      }

      let content = await readFile(this.sourceDir, 'utf-8')

      if (toolConfig?.instructions?.transform) {
        content = await toolConfig.instructions.transform(content, this.sourceDir)
      }

      await ensureDirectoryExists(dirname(targetPath))
      await writeFile(targetPath, content, 'utf-8')
      this.reportSuccess(`Instructions → ${tool}`)
      results.success++
    }
    catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'Unknown error'
      this.reportError(`Instructions 迁移失败 (${tool})`, errorMessage)
      results.error++
      results.errors.push({ file: targetPath, error: errorMessage })
    }

    return results
  }
}
