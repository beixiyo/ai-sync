/**
 * MCP 转换器
 */

import type { LocalMCPConfig, MCPServerConfig, RemoteMCPConfig } from '../types/config'

/**
 * 判断是否为本地 MCP 配置
 */
export function isLocalMCPConfig(config: MCPServerConfig): config is LocalMCPConfig {
  return 'command' in config
}

/**
 * 判断是否为远程 MCP 配置
 */
export function isRemoteMCPConfig(config: MCPServerConfig): config is RemoteMCPConfig {
  return 'url' in config || 'httpUrl' in config
}

/**
 * 转换为 Codex 格式
 */
export function convertToCodexFormat(sourceConfig: any): any {
  const mcpServers = sourceConfig.mcpServers || {}
  const codexMcp: Record<string, any> = {}

  Object.entries(mcpServers as Record<string, MCPServerConfig>).forEach(([name, server]) => {
    if (isLocalMCPConfig(server)) {
      codexMcp[name] = {
        command: server.command,
        args: server.args || [],
        ...(server.env && Object.keys(server.env).length > 0
          ? { env: server.env }
          : {}),
      }
    }
    else if (isRemoteMCPConfig(server)) {
      codexMcp[name] = {
        url: server.url || server.httpUrl,
        ...(server.headers && Object.keys(server.headers).length > 0
          ? { http_headers: server.headers }
          : {}),
      }
    }
  })

  return { mcp_servers: codexMcp }
}

/**
 * 转换为 OpenCode 格式
 */
export function convertToOpenCodeFormat(sourceConfig: any): any {
  const mcpServers = sourceConfig.mcpServers || {}
  const opencodeMcp: Record<string, any> = {}

  Object.entries(mcpServers as Record<string, MCPServerConfig>).forEach(([name, server]) => {
    if (isLocalMCPConfig(server)) {
      opencodeMcp[name] = {
        type: 'local',
        command: Array.isArray(server.command)
          ? server.command
          : [server.command, ...(server.args || [])],
        enabled: true,
      }
    }
    else if (isRemoteMCPConfig(server)) {
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

  return { mcp: opencodeMcp }
}

/**
 * 转换为 Gemini/IFlow 格式
 */
export function convertToGeminiFormat(sourceConfig: any): any {
  const mcpServers = sourceConfig.mcpServers || {}
  const geminiMcp: Record<string, any> = {}

  Object.entries(mcpServers as Record<string, MCPServerConfig>).forEach(([name, server]) => {
    if (isRemoteMCPConfig(server)) {
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

  return { mcpServers: geminiMcp }
}
