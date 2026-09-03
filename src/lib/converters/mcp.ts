/**
 * MCP 转换器
 */

import type { LocalMCPConfig, MCPServerConfig, RemoteMCPConfig } from '../types/config'

const ENV_REF_RE = /\$\{([A-Z_][A-Z0-9_]*)(?::-([^}]*))?\}/gi
const PURE_ENV_REF_RE = /^\$\{([A-Z_][A-Z0-9_]*)(?::-([^}]*))?\}$/i
const BEARER_ENV_REF_RE = /^Bearer\s+\$\{([A-Z_][A-Z0-9_]*)(?::-([^}]*))?\}$/i

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
      const [command, ...commandArgs] = normalizeCommand(server.command)
      const args = [...commandArgs, ...(server.args || [])]
      const env = server.env || {}
      const envVars = collectPureEnvVars(env)
      const staticEnv = omitPureEnvVars(env)
      const argEnvVars = collectEnvRefs([command, ...args])
      const hasArgEnvRefs = argEnvVars.length > 0

      codexMcp[name] = {
        command: hasArgEnvRefs
          ? 'sh'
          : command,
        args: hasArgEnvRefs
          ? ['-lc', `exec ${[command, ...args].map(arg => shellQuote(rewriteEnvRefsForShell(arg))).join(' ')}`]
          : args,
        ...(envVars.length > 0 || hasArgEnvRefs
          ? { env_vars: unique([...envVars, ...argEnvVars]) }
          : {}),
        ...(Object.keys(staticEnv).length > 0
          ? { env: staticEnv }
          : {}),
        /** 默认免确认执行该 server 的工具 */
        default_tools_approval_mode: 'approve',
      }
    }
    else if (isRemoteMCPConfig(server)) {
      const { bearerTokenEnvVar, envHttpHeaders, httpHeaders } = splitHeadersForCodex(server.headers || {})

      codexMcp[name] = {
        url: server.url || server.httpUrl,
        ...(bearerTokenEnvVar
          ? { bearer_token_env_var: bearerTokenEnvVar }
          : {}),
        ...(Object.keys(envHttpHeaders).length > 0
          ? { env_http_headers: envHttpHeaders }
          : {}),
        ...(Object.keys(httpHeaders).length > 0
          ? { http_headers: httpHeaders }
          : {}),
        /** 默认免确认执行该 server 的工具 */
        default_tools_approval_mode: 'approve',
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
      const command = Array.isArray(server.command)
        ? server.command
        : [server.command, ...(server.args || [])]

      opencodeMcp[name] = {
        type: 'local',
        command: command.map(convertClaudeEnvRefsToOpenCode),
        ...(server.env && Object.keys(server.env).length > 0
          ? { environment: convertRecordEnvRefsToOpenCode(server.env) }
          : {}),
        enabled: true,
      }
    }
    else if (isRemoteMCPConfig(server)) {
      opencodeMcp[name] = {
        type: 'remote',
        url: server.url || server.httpUrl,
        ...(server.headers && Object.keys(server.headers).length > 0
          ? { headers: convertRecordEnvRefsToOpenCode(server.headers) }
          : {}),
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

/**
 * 转换为 ZCode 格式
 * ZCode 使用 `mcp.servers` 两层嵌套结构，本地（command/args/env）字段与 Claude Code 一致
 * 远程配置将 `httpUrl` 归一化为 `url`，其余字段原样保留
 */
export function convertToZCodeFormat(sourceConfig: any): any {
  const mcpServers = sourceConfig.mcpServers || {}
  const servers: Record<string, any> = {}

  Object.entries(mcpServers as Record<string, MCPServerConfig>).forEach(([name, server]) => {
    if (isRemoteMCPConfig(server)) {
      const url = server.url || server.httpUrl
      servers[name] = {
        ...(url ? { url } : {}),
        ...(server.type ? { type: server.type } : {}),
        ...(server.headers && Object.keys(server.headers).length > 0
          ? { headers: server.headers }
          : {}),
      }
    }
    else {
      servers[name] = { ...(server as any) }
    }
  })

  return { mcp: { servers } }
}

function normalizeCommand(command: string | string[]): string[] {
  return Array.isArray(command)
    ? command
    : [command]
}

function collectPureEnvVars(env: Record<string, string>): string[] {
  return Object.values(env).flatMap((value) => {
    const match = value.match(PURE_ENV_REF_RE)
    return match && !match[2]
      ? [match[1]]
      : []
  })
}

function omitPureEnvVars(env: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter(([, value]) => !PURE_ENV_REF_RE.test(value)),
  )
}

function collectEnvRefs(values: string[]): string[] {
  return unique(values.flatMap((value) => {
    return [...value.matchAll(ENV_REF_RE)].map(match => match[1])
  }))
}

function convertClaudeEnvRefsToOpenCode(value: string): string {
  return value.replace(ENV_REF_RE, (_, name) => `{env:${name}}`)
}

function convertRecordEnvRefsToOpenCode(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, convertClaudeEnvRefsToOpenCode(value)]),
  )
}

function splitHeadersForCodex(headers: Record<string, string>): {
  bearerTokenEnvVar?: string
  envHttpHeaders: Record<string, string>
  httpHeaders: Record<string, string>
} {
  const envHttpHeaders: Record<string, string> = {}
  const httpHeaders: Record<string, string> = {}
  let bearerTokenEnvVar: string | undefined

  for (const [key, value] of Object.entries(headers)) {
    const bearerMatch = value.match(BEARER_ENV_REF_RE)
    if (key.toLowerCase() === 'authorization' && bearerMatch && !bearerMatch[2]) {
      bearerTokenEnvVar = bearerMatch[1]
      continue
    }

    const pureMatch = value.match(PURE_ENV_REF_RE)
    if (pureMatch && !pureMatch[2]) {
      envHttpHeaders[key] = pureMatch[1]
      continue
    }

    httpHeaders[key] = value
  }

  return { bearerTokenEnvVar, envHttpHeaders, httpHeaders }
}

function rewriteEnvRefsForShell(value: string): string {
  return value.replace(ENV_REF_RE, (_, name, defaultValue) => {
    return defaultValue === undefined
      ? `$${name}`
      : `\${${name}:-${defaultValue}}`
  })
}

function shellQuote(value: string): string {
  if (hasShellEnvRef(value))
    return `"${escapeDoubleQuotedShellArg(value)}"`

  return `'${value.replaceAll(`'`, `'"'"'`)}'`
}

function hasShellEnvRef(value: string): boolean {
  return /\$[A-Z_][A-Z0-9_]*/i.test(value) || /\$\{[A-Z_][A-Z0-9_]*:-[^}]*\}/i.test(value)
}

function escapeDoubleQuotedShellArg(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('`', '\\`')
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}
