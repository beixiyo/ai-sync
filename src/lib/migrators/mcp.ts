import type { ToolConfig, ToolKey } from '../config'
import type { MigrateOptions, MigrationStats } from './types'
import { fileExists, readJSONFile, readTOMLFile, writeJSONFile, writeTOMLFile } from '../utils/file'
import { BaseMigrator } from './base'

export class MCPMigrator extends BaseMigrator {
  constructor(sourceFile: string, targetTools: ToolKey[], options: MigrateOptions, tools: Record<ToolKey, ToolConfig>) {
    super(sourceFile, targetTools, options, 'mcp', tools)
  }

  async migrate(): Promise<MigrationStats> {
    if (!(await fileExists(this.sourceDir)))
      return { success: 0, skipped: 0, error: 0, errors: [] }
    return super.migrate()
  }

  protected async migrateForTool(tool: ToolKey, targetPath: string): Promise<MigrationStats> {
    const results: MigrationStats = { success: 0, skipped: 0, error: 0, errors: [] }

    try {
      const sourceContent = await readJSONFile<any>(this.sourceDir)
      const isToml = targetPath.endsWith('.toml')

      let targetConfig: any = {}
      if (await fileExists(targetPath)) {
        if (isToml) targetConfig = await readTOMLFile(targetPath)
        else targetConfig = await readJSONFile(targetPath)
      }

      const transform = this.tools[tool]?.mcp?.transform
      const converted = transform
        ? await transform(sourceContent)
        : { mcpServers: { ...(sourceContent.mcpServers || {}) } }

      if (this.options.autoOverwrite) {
        /** 如果是自动覆盖模式，直接替换关键配置项 (If auto-overwrite, replace key config items directly) */
        for (const key in converted) {
          targetConfig[key] = converted[key]
        }
      }
      else {
        /** 否则执行深度合并 (Otherwise perform deep merge) */
        for (const key in converted) {
          const value = converted[key]
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            targetConfig[key] = { ...(targetConfig[key] || {}), ...value }
          }
          else {
            targetConfig[key] = value
          }
        }
      }

      if (isToml)
        await writeTOMLFile(targetPath, targetConfig)
      else await writeJSONFile(targetPath, targetConfig)

      /** CodeBuddy 特殊处理：同时同步到 mcp.json (CodeBuddy special: also sync to mcp.json) */
      if (tool === 'codebuddy' && targetPath.endsWith('.mcp.json')) {
        const secondaryPath = targetPath.replace('.mcp.json', 'mcp.json')
        await writeJSONFile(secondaryPath, targetConfig)
      }

      results.success++
      this.reportSuccess(`MCP 迁移完成: ${tool}`)
    }
    catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : '迁移失败'
      results.error++
      results.errors.push({ file: targetPath, error: errorMessage })
      this.reportError(`MCP 迁移失败 (${tool})`, errorMessage)
    }
    return results
  }
}
