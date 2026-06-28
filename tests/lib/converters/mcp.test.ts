import { convertToCodexFormat, convertToOpenCodeFormat } from '@lib/converters/mcp'
import { describe, expect, it } from 'vitest'

const envRef = (name: string) => `$${`{${name}}`}`

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
