/**
 * MCP 转换器
 *
 * 统一源格式为 Claude Code（`~/.claude.json` 的 `mcpServers`），
 * 转换为各工具的 MCP 配置结构：Codex（TOML `mcp_servers`）、OpenCode（`mcp`）、
 * Gemini/IFlow（`httpUrl`）、ZCode（`mcp.servers` 两层嵌套）、Pi（原生 `~/.pi/agent/mcp.json`）
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
 * Claude MCP → Codex MCP（写入 `~/.codex/config.toml` 的 `[mcp_servers.*]`）
 *
 * - `env` 中的 `${VAR}` 纯引用提取为 `env_vars`，静态值留在 `env`
 * - args 里的 `${VAR}` 引用需经 shell 展开，整体改写为 `sh -lc 'exec ...'`
 * - headers 中的 `Authorization: Bearer ${VAR}` 提取为 `bearer_token_env_var`
 *
 * @example
 * ```txt
 * 输入（Claude ~/.claude.json）:
 *   { "mcpServers": { "context7": {
 *     "command": "npx", "args": ["-y", "@upstash/context7-mcp"],
 *     "env": { "KEY": "${CONTEXT7_API_KEY}" } } } }
 *
 * 输出（Codex ~/.codex/config.toml）:
 *   [mcp_servers.context7]
 *   command = "npx"
 *   args = ["-y", "@upstash/context7-mcp"]
 *   env_vars = ["CONTEXT7_API_KEY"]
 *   default_tools_approval_mode = "approve"
 * ```
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
 * Claude MCP → OpenCode MCP（写入 `~/.config/opencode/opencode.jsonc` 的 `mcp` 字段）
 *
 * - `command` 合并 `args` 为数组
 * - 环境变量引用 `${VAR}` → `{env:VAR}`
 * - 统一补 `type`（local/remote）和 `enabled: true`
 *
 * @example
 * ```txt
 * 输入（Claude）:
 *   { "context7": { "command": "npx", "args": ["-y", "pkg"],
 *     "env": { "KEY": "${MY_KEY}" } } }
 *
 * 输出（OpenCode）:
 *   { "mcp": { "context7": { "type": "local",
 *     "command": ["npx", "-y", "pkg"],
 *     "environment": { "KEY": "{env:MY_KEY}" }, "enabled": true } } }
 * ```
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
 * Claude MCP → Gemini/IFlow MCP（写入 `~/.gemini/settings.json` / `~/.iflow/settings.json`）
 *
 * 远程 server 的 `url` 归一化为 `httpUrl` 并标记 `type: "streamable-http"`，
 * 本地 server 字段与 Claude 一致，原样保留
 *
 * @example
 * ```txt
 * 输入（Claude）:  { "lsp": { "type": "http", "url": "http://127.0.0.1:9527/mcp" } }
 * 输出（Gemini）:  { "lsp": { "httpUrl": "http://127.0.0.1:9527/mcp", "type": "streamable-http" } }
 * ```
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
 * Claude MCP → ZCode MCP（写入 `~/.zcode/cli/config.json`）
 *
 * `mcpServers` 平铺结构 → `mcp.servers` 两层嵌套；
 * 远程配置将 `httpUrl` 归一化为 `url`，本地（command/args/env）字段与 Claude 一致原样保留
 *
 * @example
 * ```txt
 * 输入（Claude）:   { "mcpServers": { "context7": { "command": "npx", "args": ["pkg"] } } }
 * 输出（ZCode）:   { "mcp": { "servers": { "context7": { "command": "npx", "args": ["pkg"] } } } }
 * ```
 */
export function convertToZCodeFormat(sourceConfig: any): any {
  const mcpServers = sourceConfig.mcpServers || {}
  const servers: Record<string, any> = {}

  Object.entries(mcpServers as Record<string, MCPServerConfig>).forEach(([name, server]) => {
    if (isRemoteMCPConfig(server)) {
      const url = server.url || server.httpUrl
      servers[name] = {
        ...(url
          ? { url }
          : {}),
        ...(server.type
          ? { type: server.type }
          : {}),
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

/**
 * 只接受已知客户端动态注册的远程 server：同步到 pi 时注入的 OAuth 客户端名
 * 按 URL 主机名匹配（而非 server 名），改名不会失效
 */
const PI_OAUTH_CLIENT_NAMES: Record<string, string> = {
  'mcp.figma.com': 'Claude Code',
}

/**
 * Claude MCP → Pi 原生 MCP（写入 `~/.pi/agent/mcp.json`）
 *
 * `mcpServers` 结构与 Claude 一致，条目原样保留。唯一注入：Figma 等只接受已知客户端的
 * 远程 server 补 `oauth.clientName`，否则 pi 以默认名 `pi` 动态注册会被拒。
 *
 * 注入放在转换层而非依赖目标文件已有内容：MCPMigrator 对 `mcpServers` 的合并是整条替换，
 * 目标里手写的 oauth 会被源条目冲掉，所以必须由 ai-sync 每次生成。源里已显式写了 `oauth` 则尊重源
 *
 * @example
 * ```txt
 * 输入:  { "mcpServers": { "figma-mcp": { "type": "http", "url": "https://mcp.figma.com/mcp" } } }
 * 输出:  { "mcpServers": { "figma-mcp": { "type": "http", "url": "https://mcp.figma.com/mcp",
 *          "oauth": { "clientName": "Claude Code" } } } }
 * ```
 */
export function convertToPiFormat(sourceConfig: any): any {
  const mcpServers = sourceConfig.mcpServers || {}
  const piMcp: Record<string, any> = {}

  Object.entries(mcpServers as Record<string, MCPServerConfig>).forEach(([name, server]) => {
    const url = isRemoteMCPConfig(server)
      ? server.url || server.httpUrl
      : undefined
    const clientName = url && URL.canParse(url)
      ? PI_OAUTH_CLIENT_NAMES[new URL(url).hostname]
      : undefined

    piMcp[name] = clientName && !('oauth' in server)
      ? { ...(server as any), oauth: { clientName } }
      : { ...(server as any) }
  })

  return { mcpServers: piMcp }
}

/**
 * pi 中由用户在 `/mcp` 或手写维护、Claude 源里不存在的 server 级设置
 */
const PI_USER_SERVER_FIELDS = ['exposure', 'toolExposure', 'enabled', 'description', 'timeout'] as const

/**
 * 把已有 `~/.pi/agent/mcp.json` 中的用户设置带回 {@link convertToPiFormat} 的结果
 *
 * MCPMigrator 对 `mcpServers` 是整条替换，不处理的话 `/mcp` 里改的 exposure/enabled 每次同步都会丢。
 * 仅处理两边都存在的 server（源里已删除的 server 随之消失）；转换结果里已有的字段优先，不被旧值覆盖
 */
export function preservePiServerSettings(converted: any, existing: any): any {
  const existingServers = existing?.mcpServers
  if (!existingServers || typeof existingServers !== 'object')
    return converted

  const mcpServers: Record<string, any> = {}
  for (const [name, server] of Object.entries(converted.mcpServers || {}) as [string, any][]) {
    const old = existingServers[name]
    const kept = Object.fromEntries(
      PI_USER_SERVER_FIELDS
        .filter(field => old && field in old && !(field in server))
        .map(field => [field, old[field]]),
    )
    mcpServers[name] = { ...server, ...kept }
  }

  return { ...converted, mcpServers }
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
