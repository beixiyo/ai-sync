import type { LocalMCPConfig, MCPServerConfig, RemoteMCPConfig, ToolConfig, ToolKey } from '../config'
import type { MigrateOptions, MigrationStats } from './types'
import chalk from 'chalk'
import { fileExists, readJSONFile, readTOMLFile, writeJSONFile, writeTOMLFile } from '../utils/file'
import { getOpenCodeMCPPath } from '../path'
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

    // 对于 OpenCode，检测实际的文件路径（.json 或 .jsonc）
    let actualTargetPath = targetPath
    if (tool === 'opencode') {
      const dir = targetPath.substring(0, targetPath.lastIndexOf('/'))
      actualTargetPath = await getOpenCodeMCPPath(dir)
    }

    try {
      const sourceContent = await readJSONFile<any>(this.sourceDir)
      const isToml = actualTargetPath.endsWith('.toml')

      if (toolConfig?.mcp?.transform) {
        const transformed = await toolConfig.mcp.transform(sourceContent)
        if (isToml) {
          await writeTOMLFile(actualTargetPath, transformed)
        }
        else {
          await writeJSONFile(actualTargetPath, transformed)
        }
        results.success++
      }
      else if (tool === 'claude') {
        // Claude 合并处理：更新 mcpServers 字段，保留其他字段
        let targetConfig: any = {}
        if (await fileExists(actualTargetPath)) {
          targetConfig = await readJSONFile<any>(actualTargetPath)
        }

        targetConfig.mcpServers = sourceContent.mcpServers || {}
        await writeJSONFile(actualTargetPath, targetConfig)
        results.success++
      }
      else if (tool === 'codex') {
        // Codex 特殊处理：更新 config.toml 中的 mcp_servers 节点
        let config: any = {}
        if (await fileExists(actualTargetPath)) {
          config = await readTOMLFile<any>(actualTargetPath)
        }

        config.mcp_servers = this.convertMCPToCodexFormat(sourceContent.mcpServers || {})
        await writeTOMLFile(actualTargetPath, config)
        results.success++
      }
      else if (tool === 'opencode') {
        // OpenCode 特殊处理：合并 mcp 配置，保留其他字段（如 permission）
        let targetConfig: any = {}
        if (await fileExists(actualTargetPath)) {
          targetConfig = await readJSONFile<any>(actualTargetPath)
        }

        // 转换并更新 mcp 字段
        const convertedMcp = this.convertToOpenCodeFormat(sourceContent.mcpServers || {})
        targetConfig.mcp = convertedMcp

        await writeJSONFile(actualTargetPath, targetConfig)
        results.success++
      }
      else if (tool === 'cursor' || tool === 'gemini' || tool === 'iflow') {
        // 这些工具的特殊处理：合并 mcpServers 配置，保留其他字段
        let targetConfig: any = {}
        if (await fileExists(actualTargetPath)) {
          targetConfig = await readJSONFile<any>(actualTargetPath)
        }

        // 转换并更新 mcpServers 字段
        let convertedMcpServers: Record<string, any> = {}
        if (tool === 'cursor') {
          convertedMcpServers = { ...sourceContent.mcpServers || {} }
        }
        else if (tool === 'gemini' || tool === 'iflow') {
          convertedMcpServers = this.convertToGeminiFormat(sourceContent.mcpServers || {})
        }
        targetConfig.mcpServers = convertedMcpServers

        await writeJSONFile(actualTargetPath, targetConfig)
        results.success++
      }
      else {
        // 自定义工具也进行合并处理
        let targetConfig: any = {}
        if (await fileExists(actualTargetPath)) {
          targetConfig = await readJSONFile<any>(actualTargetPath)
        }

        // 转换 MCP 配置，然后合并到现有配置
        const converted = this.convertMCPConfig(sourceContent, tool)
        Object.assign(targetConfig, converted)

        await writeJSONFile(actualTargetPath, targetConfig)
        results.success++
      }
      console.log(chalk.green(`✓ MCP 迁移完成: ${tool} (MCP migration complete: ${tool})`))
    }
    catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : '迁移失败 (Migration failed)'
      results.error++
      results.errors.push({ file: actualTargetPath, error: errorMessage })
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
