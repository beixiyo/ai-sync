import { convertToCodexFormat, convertToOpenCodeFormat, convertToPiFormat, convertToZCodeFormat, preservePiServerSettings } from '@lib/converters/mcp'
import { describe, expect, it } from 'vitest'

const envRef = (name: string) => `$${`{${name}}`}`
const envRefDefault = (name: string, fallback: string) => `$${`{${name}:-${fallback}}`}`

describe('mCP converter env handling', () => {
  it('converts Claude env expansion to OpenCode env placeholders', () => {
    const result = convertToOpenCodeFormat({
      mcpServers: {
        'local-mcp': {
          command: 'npx',
          args: ['-y', 'some-mcp', '--api-key', envRef('SOME_API_KEY')],
          env: {
            SOME_API_KEY: envRef('SOME_API_KEY'),
          },
        },
        'remote-mcp': {
          type: 'http',
          url: 'https://example.com/mcp',
          headers: {
            Authorization: `Bearer ${envRef('REMOTE_TOKEN')}`,
          },
        },
      },
    })

    expect(result.mcp['local-mcp']).toEqual({
      type: 'local',
      command: ['npx', '-y', 'some-mcp', '--api-key', '{env:SOME_API_KEY}'],
      environment: {
        SOME_API_KEY: '{env:SOME_API_KEY}',
      },
      enabled: true,
    })
    expect(result.mcp['remote-mcp']).toEqual({
      type: 'remote',
      url: 'https://example.com/mcp',
      headers: {
        Authorization: 'Bearer {env:REMOTE_TOKEN}',
      },
      enabled: true,
    })
  })

  it('converts process env based stdio MCP config to Codex env_vars', () => {
    const result = convertToCodexFormat({
      mcpServers: {
        'context7-mcp': {
          command: 'npx',
          args: ['-y', '@upstash/context7-mcp'],
          env: {
            CONTEXT7_API_KEY: envRef('CONTEXT7_API_KEY'),
            NODE_ENV: 'development',
          },
        },
      },
    })

    expect(result.mcp_servers['context7-mcp']).toEqual({
      command: 'npx',
      args: ['-y', '@upstash/context7-mcp'],
      env_vars: ['CONTEXT7_API_KEY'],
      env: {
        NODE_ENV: 'development',
      },
      default_tools_approval_mode: 'approve',
    })
  })

  it('converts Codex remote header env values to env-aware fields', () => {
    const result = convertToCodexFormat({
      mcpServers: {
        figma: {
          type: 'http',
          url: 'https://mcp.figma.com/mcp',
          headers: {
            'Authorization': `Bearer ${envRef('FIGMA_OAUTH_TOKEN')}`,
            'X-Feature': envRef('FEATURE_FLAG'),
            'X-Static': 'static',
          },
        },
      },
    })

    expect(result.mcp_servers.figma).toEqual({
      url: 'https://mcp.figma.com/mcp',
      bearer_token_env_var: 'FIGMA_OAUTH_TOKEN',
      env_http_headers: {
        'X-Feature': 'FEATURE_FLAG',
      },
      http_headers: {
        'X-Static': 'static',
      },
      default_tools_approval_mode: 'approve',
    })
  })

  it('forwards env refs with defaults via env_vars instead of dropping them', () => {
    const result = convertToCodexFormat({
      mcpServers: {
        'default-env': {
          command: 'npx',
          args: ['-y', 'mcp'],
          env: {
            TOKEN: envRefDefault('MY_TOKEN', 'fallback'),
            STATIC: 'keep',
          },
        },
      },
    })

    expect(result.mcp_servers['default-env']).toEqual({
      command: 'npx',
      args: ['-y', 'mcp'],
      env_vars: ['MY_TOKEN'],
      env: { STATIC: 'keep' },
      default_tools_approval_mode: 'approve',
    })
  })

  it('forwards headers with default refs as env-backed fields instead of literals', () => {
    const result = convertToCodexFormat({
      mcpServers: {
        api: {
          type: 'http',
          url: 'https://example.com/mcp',
          headers: {
            'Authorization': `Bearer ${envRefDefault('TOKEN', 'x')}`,
            'X-Feature': envRefDefault('FEATURE', 'y'),
          },
        },
      },
    })

    expect(result.mcp_servers.api).toEqual({
      url: 'https://example.com/mcp',
      bearer_token_env_var: 'TOKEN',
      env_http_headers: { 'X-Feature': 'FEATURE' },
      default_tools_approval_mode: 'approve',
    })
  })

  it('forwards source enabled=false to codex and omits it when absent', () => {
    const result = convertToCodexFormat({
      mcpServers: {
        'db-mcp': { command: 'npx', enabled: false },
        'remote-mcp': { type: 'http', url: 'https://example.com/mcp', enabled: false },
        'plain-mcp': { command: 'npx' },
      },
    })

    expect(result.mcp_servers['db-mcp'].enabled).toBe(false)
    expect(result.mcp_servers['remote-mcp'].enabled).toBe(false)
    expect(result.mcp_servers['plain-mcp'].enabled).toBeUndefined()
  })

  it('keeps OpenCode source enabled=false and defaults to true when absent', () => {
    const result = convertToOpenCodeFormat({
      mcpServers: {
        'db-mcp': { command: 'npx', enabled: false },
        'on-mcp': { command: 'npx' },
      },
    })

    expect(result.mcp['db-mcp'].enabled).toBe(false)
    expect(result.mcp['on-mcp'].enabled).toBe(true)
  })

  it('uses a shell wrapper when Codex args need env expansion', () => {
    const result = convertToCodexFormat({
      mcpServers: {
        'arg-only-mcp': {
          command: 'npx',
          args: ['-y', 'some-mcp', '--api-key', envRef('SOME_API_KEY'), `--project-id=${envRef('APIFOX_PROJECT_ID')}`],
        },
      },
    })

    expect(result.mcp_servers['arg-only-mcp']).toEqual({
      command: 'sh',
      args: ['-lc', 'exec \'npx\' \'-y\' \'some-mcp\' \'--api-key\' "$SOME_API_KEY" "--project-id=$APIFOX_PROJECT_ID"'],
      env_vars: ['SOME_API_KEY', 'APIFOX_PROJECT_ID'],
      default_tools_approval_mode: 'approve',
    })
  })
})

describe('zCode converter', () => {
  it('wraps servers under mcp.servers and keeps local fields as-is', () => {
    const result = convertToZCodeFormat({
      mcpServers: {
        'local-mcp': {
          command: 'npx',
          args: ['-y', 'some-mcp'],
          env: {
            NODE_ENV: 'development',
          },
        },
      },
    })

    expect(result).toEqual({
      mcp: {
        servers: {
          'local-mcp': {
            command: 'npx',
            args: ['-y', 'some-mcp'],
            env: {
              NODE_ENV: 'development',
            },
          },
        },
      },
    })
  })

  it('normalizes remote httpUrl to url and keeps type/headers', () => {
    const result = convertToZCodeFormat({
      mcpServers: {
        'remote-mcp': {
          type: 'http',
          url: 'https://example.com/mcp',
          headers: {
            Authorization: 'Bearer token',
          },
        },
        'legacy-remote': {
          httpUrl: 'https://legacy.example.com/mcp',
        },
      },
    })

    expect(result.mcp.servers['remote-mcp']).toEqual({
      url: 'https://example.com/mcp',
      type: 'http',
      headers: {
        Authorization: 'Bearer token',
      },
    })
    expect(result.mcp.servers['legacy-remote']).toEqual({
      url: 'https://legacy.example.com/mcp',
    })
  })

  it('returns empty servers when source has no mcpServers', () => {
    expect(convertToZCodeFormat({})).toEqual({ mcp: { servers: {} } })
  })
})

describe('pi MCP converter', () => {
  it('figma 远程 server 注入 oauth.clientName，其余条目原样保留', () => {
    const local = { type: 'stdio', command: 'npx', args: ['-y', 'pkg'], env: { KEY: envRef('KEY') } }
    const other = { type: 'http', url: 'https://mcp.exa.ai' }
    const result = convertToPiFormat({
      mcpServers: {
        'figma-mcp': { type: 'http', url: 'https://mcp.figma.com/mcp' },
        'renamed-figma': { url: 'https://mcp.figma.com/mcp' },
        'local': local,
        'search': other,
      },
    })

    expect(result.mcpServers['figma-mcp'].oauth).toEqual({ clientName: 'Claude Code' })
    /** 按 URL 而非 server 名匹配 */
    expect(result.mcpServers['renamed-figma'].oauth).toEqual({ clientName: 'Claude Code' })
    expect(result.mcpServers.local).toEqual(local)
    expect(result.mcpServers.search).toEqual(other)
  })

  it('源条目已显式声明 oauth 时不覆盖', () => {
    const oauth = { clientId: 'mine', callbackPort: 8765 }
    const result = convertToPiFormat({
      mcpServers: { figma: { url: 'https://mcp.figma.com/mcp', oauth } },
    })

    expect(result.mcpServers.figma.oauth).toEqual(oauth)
  })
})

describe('pi MCP 用户设置保留', () => {
  const converted = convertToPiFormat({
    mcpServers: {
      lsp: { type: 'stdio', command: 'vv-mcp' },
      figma: { type: 'http', url: 'https://mcp.figma.com/mcp' },
    },
  })

  it('同步后保留 /mcp 里设置的 exposure 等字段，并保留 figma 的 oauth', () => {
    const result = preservePiServerSettings(converted, {
      mcpServers: {
        lsp: { command: 'old', exposure: 'direct', enabled: false, toolExposure: { 'get_*': 'hidden' } },
        gone: { command: 'x', exposure: 'direct' },
      },
    })

    expect(result.mcpServers.lsp).toEqual({
      type: 'stdio',
      command: 'vv-mcp',
      exposure: 'direct',
      enabled: false,
      toolExposure: { 'get_*': 'hidden' },
    })
    expect(result.mcpServers.figma.oauth).toEqual({ clientName: 'Claude Code' })
    /** 源里已删除的 server 不复活 */
    expect(result.mcpServers.gone).toBeUndefined()
  })

  it('preserves pi-side cwd / oauth / auth fields missing from the source', () => {
    const converted = convertToPiFormat({
      mcpServers: {
        tools: { type: 'stdio', command: 'uvx', args: ['tools'] },
        sentry: { type: 'http', url: 'https://mcp.sentry.dev/mcp' },
      },
    })
    const result = preservePiServerSettings(converted, {
      mcpServers: {
        tools: { command: 'old', cwd: '/work/tools' },
        sentry: {
          url: 'https://mcp.sentry.dev/mcp',
          oauth: { authServerMetadataUrl: 'https://example.okta.com/.well-known/openid-configuration' },
          auth: { provider: 'github' },
        },
      },
    })

    expect(result.mcpServers.tools.cwd).toBe('/work/tools')
    expect(result.mcpServers.sentry.oauth).toEqual({
      authServerMetadataUrl: 'https://example.okta.com/.well-known/openid-configuration',
    })
    expect(result.mcpServers.sentry.auth).toEqual({ provider: 'github' })
  })

  it('目标文件不存在时原样返回；源里显式声明的字段优先', () => {
    expect(preservePiServerSettings(converted, undefined)).toBe(converted)

    const result = preservePiServerSettings(
      { mcpServers: { a: { command: 'a', exposure: 'hidden' } } },
      { mcpServers: { a: { exposure: 'direct' } } },
    )
    expect(result.mcpServers.a.exposure).toBe('hidden')
  })
})
