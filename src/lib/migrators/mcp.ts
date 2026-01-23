import type { LocalMCPConfig, MCPServerConfig, RemoteMCPConfig, ToolConfig, ToolKey } from '../config'
import type { MigrateOptions, MigrationStats } from './types'
import chalk from 'chalk'
import { getOpenCodeMCPPath } from '../path'
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
    const actualTargetPath = tool === 'opencode'
      ? await getOpenCodeMCPPath(targetPath.substring(0, targetPath.lastIndexOf('/')))
      : targetPath

    try {
      const sourceContent = await readJSONFile<any>(this.sourceDir)
      const isToml = actualTargetPath.endsWith('.toml')

      let targetConfig: any = {}
      if (await fileExists(actualTargetPath)) {
        targetConfig = isToml
          ? await readTOMLFile(actualTargetPath)
          : await readJSONFile(actualTargetPath)
      }

      const converted = this.convertMCPConfig(sourceContent, tool)

      for (const key in converted) {
        const value = converted[key]
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          targetConfig[key] = { ...(targetConfig[key] || {}), ...value }
        }
        else {
          targetConfig[key] = value
        }
      }

      if (isToml)
        await writeTOMLFile(actualTargetPath, targetConfig)
      else await writeJSONFile(actualTargetPath, targetConfig)

      results.success++
      console.log(chalk.green(`✓ MCP 迁移完成: ${tool}`))
    }
    catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : '迁移失败'
      results.error++
      results.errors.push({ file: actualTargetPath, error: errorMessage })
      console.error(chalk.red(`✗ MCP 迁移失败 (${tool}): ${errorMessage}`))
    }
    return results
  }

  private convertMCPConfig(sourceConfig: any, tool: ToolKey): any {
    const mcpServers = sourceConfig.mcpServers || {}
    switch (tool) {
      case 'opencode':
        return { mcp: this.convertToOpenCodeFormat(mcpServers) }
      case 'codex':
        return { mcp_servers: this.convertMCPToCodexFormat(mcpServers) }
      case 'gemini':
      case 'iflow':
        return { mcpServers: this.convertToGeminiFormat(mcpServers) }
      default:
        return { mcpServers: { ...mcpServers } }
    }
  }

  private isLocalMCPConfig(config: MCPServerConfig): config is LocalMCPConfig {
    return 'command' in config
  }

  private isRemoteMCPConfig(config: MCPServerConfig): config is RemoteMCPConfig {
    return 'url' in config || 'httpUrl' in config
  }

  private convertMCPToCodexFormat(mcpServers: Record<string, MCPServerConfig>): Record<string, any> {
    const codexMcp: Record<string, any> = {}
    Object.entries(mcpServers).forEach(([name, server]) => {
      if (this.isLocalMCPConfig(server)) {
        codexMcp[name] = {
          command: server.command,
          args: server.args || [],
          ...(server.env && Object.keys(server.env).length > 0
            ? { env: server.env }
            : {}),
        }
      }
      else if (this.isRemoteMCPConfig(server)) {
        codexMcp[name] = {
          url: server.url || server.httpUrl,
          ...(server.headers && Object.keys(server.headers).length > 0
            ? { http_headers: server.headers }
            : {}),
        }
      }
    })
    return codexMcp
  }

  private convertToOpenCodeFormat(mcpServers: Record<string, MCPServerConfig>): Record<string, any> {
    const opencodeMcp: Record<string, any> = {}
    Object.entries(mcpServers).forEach(([name, server]) => {
      if (this.isLocalMCPConfig(server)) {
        opencodeMcp[name] = {
          type: 'local',
          command: Array.isArray(server.command)
            ? server.command
            : [server.command, ...(server.args || [])],
          enabled: true,
        }
      }
      else if (this.isRemoteMCPConfig(server)) {
        opencodeMcp[name] = {
          type: 'remote',
          url: server.url || server.httpUrl,
          enabled: true,
        }
      }
      else {
        opencodeMcp[name] = { ...(server as any), enabled: true }
      }
    })
    return opencodeMcp
  }

  private convertToGeminiFormat(mcpServers: Record<string, MCPServerConfig>): Record<string, any> {
    const geminiMcp: Record<string, any> = {}
    Object.entries(mcpServers).forEach(([name, server]) => {
      if (this.isRemoteMCPConfig(server)) {
        const url = server.url || server.httpUrl
        geminiMcp[name] = {
          ...(server as any),
          httpUrl: url,
          type: 'streamable-http',
        }
        delete (geminiMcp[name] as any).url
      }
      else {
        geminiMcp[name] = { ...(server as any) }
      }
    })
    return geminiMcp
  }
}
