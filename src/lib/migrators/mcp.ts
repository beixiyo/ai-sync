import type { LocalMCPConfig, MCPServerConfig, RemoteMCPConfig, ToolConfig, ToolKey } from '../config'
import type { MigrateOptions, MigrationStats } from './types'
import chalk from 'chalk'
import { fileExists, readJSONFile, readTOMLFile, writeJSONFile, writeTOMLFile } from '../utils/file'
import { BaseMigrator } from './base'

/**
 * MCP 迁移器类
 */
export class MCPMigrator extends BaseMigrator {
  constructor(sourceFile: string, targetTools: ToolKey[], options: MigrateOptions, tools: Record<ToolKey, ToolConfig>) {
    super(sourceFile, targetTools, options, 'mcp', tools)
  }

  /**
   * 执行迁移的主入口
   */
  async migrate(): Promise<MigrationStats> {
    if (!(await fileExists(this.sourceDir))) {
      console.error(chalk.red(`✗ 源文件不存在: ${this.sourceDir} (Source file does not exist: ${this.sourceDir})`))
      return { success: 0, skipped: 0, error: 1, errors: [{ file: this.sourceDir, error: '源文件不存在 (Source file does not exist)' }] }
    }
    return super.migrate()
  }

  /**
   * 为单个工具执行迁移
   */
  protected async migrateForTool(tool: ToolKey, targetPath: string): Promise<MigrationStats> {
    const results: MigrationStats = { success: 0, skipped: 0, error: 0, errors: [] }
    const toolConfig = this.tools[tool]

    if (await fileExists(targetPath) && !this.options.autoOverwrite && tool !== 'codex') {
      results.skipped++
      return results
    }

    try {
      const sourceContent = await readJSONFile<any>(this.sourceDir)
      const isToml = targetPath.endsWith('.toml')

      if (toolConfig?.mcp?.transform) {
        const transformed = await toolConfig.mcp.transform(sourceContent)
        if (isToml) {
          await writeTOMLFile(targetPath, transformed)
        }
        else {
          await writeJSONFile(targetPath, transformed)
        }
        results.success++
      }
      else if (tool === 'claude') {
        await writeJSONFile(targetPath, sourceContent)
        results.success++
      }
      else if (tool === 'codex') {
        // Codex 特殊处理：更新 config.toml 中的 mcp_servers 节点
        let config: any = {}
        if (await fileExists(targetPath)) {
          config = await readTOMLFile<any>(targetPath)
        }

        config.mcp_servers = this.convertMCPToCodexFormat(sourceContent.mcpServers || {})
        await writeTOMLFile(targetPath, config)
        results.success++
      }
      else {
        const convertedContent = this.convertMCPConfig(sourceContent, tool)
        await writeJSONFile(targetPath, convertedContent)
        results.success++
      }
      console.log(chalk.green(`✓ MCP 迁移完成: ${tool} (MCP migration complete: ${tool})`))
    }
    catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : '迁移失败 (Migration failed)'
      results.error++
      results.errors.push({ file: targetPath, error: errorMessage })
      console.error(chalk.red(`✗ MCP 迁移失败 (${tool}): ${errorMessage} (MCP migration failed (${tool}): ${errorMessage})`))
    }

    return results
  }

  private convertMCPConfig(sourceConfig: any, tool: ToolKey): any {
    const mcpServers = sourceConfig.mcpServers || {}
    const convertedConfig: any = {}

    switch (tool) {
      case 'cursor':
        convertedConfig.mcpServers = { ...mcpServers }
        break
      case 'opencode':
        convertedConfig.mcp = this.convertToOpenCodeFormat(mcpServers)
        break
      case 'gemini':
      case 'iflow':
        convertedConfig.mcpServers = this.convertToGeminiFormat(mcpServers)
        break
      default:
        convertedConfig.mcpServers = { ...mcpServers }
    }

    return convertedConfig
  }

  private isLocalMCPConfig(config: MCPServerConfig): config is LocalMCPConfig {
    return 'command' in config
  }

  private isRemoteMCPConfig(config: MCPServerConfig): config is RemoteMCPConfig {
    return 'url' in config || 'httpUrl' in config
  }

  /**
   * 转换为 Codex 格式 (TOML)
   */
  private convertMCPToCodexFormat(mcpServers: Record<string, MCPServerConfig>): Record<string, any> {
    const codexMcp: Record<string, any> = {}

    Object.entries(mcpServers).forEach(([name, server]) => {
      if (this.isLocalMCPConfig(server)) {
        const localServer = server as LocalMCPConfig
        const config: any = {
          command: localServer.command,
          args: localServer.args || [],
        }
        if (localServer.env && Object.keys(localServer.env).length > 0) {
          config.env = localServer.env
        }
        codexMcp[name] = config
      }
      else if (this.isRemoteMCPConfig(server)) {
        const remoteServer = server as RemoteMCPConfig
        const config: any = {
          url: remoteServer.url || remoteServer.httpUrl,
        }
        if (remoteServer.headers && Object.keys(remoteServer.headers).length > 0) {
          config.http_headers = remoteServer.headers
        }
        codexMcp[name] = config
      }
    })

    return codexMcp
  }

  private convertToOpenCodeFormat(mcpServers: Record<string, MCPServerConfig>): Record<string, any> {
    const opencodeMcp: Record<string, any> = {}

    Object.entries(mcpServers).forEach(([name, server]) => {
      if (this.isLocalMCPConfig(server)) {
        const localServer = server as LocalMCPConfig
        opencodeMcp[name] = {
          type: 'local',
          command: Array.isArray(localServer.command)
            ? localServer.command
            : [localServer.command, ...(localServer.args || [])],
          enabled: true,
        }
      }
      else if (this.isRemoteMCPConfig(server)) {
        const remoteServer = server as RemoteMCPConfig
        opencodeMcp[name] = {
          type: 'remote',
          url: remoteServer.url || remoteServer.httpUrl,
          enabled: true,
        }
      }
      else {
        opencodeMcp[name] = { ...(server as object) }
      }
    })

    return opencodeMcp
  }

  private convertToGeminiFormat(mcpServers: Record<string, MCPServerConfig>): Record<string, any> {
    const geminiMcp: Record<string, any> = {}

    Object.entries(mcpServers).forEach(([name, server]) => {
      if (this.isRemoteMCPConfig(server)) {
        const remoteServer = server as RemoteMCPConfig
        const url = remoteServer.url || remoteServer.httpUrl
        if (server.type === 'http' || url) {
          geminiMcp[name] = {
            ...(server as object),
            httpUrl: url,
            type: 'streamable-http',
          }
          delete (geminiMcp[name] as any).url
        }
        else {
          geminiMcp[name] = { ...(server as object) }
        }
      }
      else {
        geminiMcp[name] = { ...(server as object) }
      }
    })

    return geminiMcp
  }
}
