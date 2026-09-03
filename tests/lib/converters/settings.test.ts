import { convertToZCodeSettingsFormat } from '@lib/converters/settings'
import { describe, expect, it } from 'vitest'

describe('zCode settings converter', () => {
  it('wraps compatible hook events under hooks.events and enables hooks', () => {
    const result = convertToZCodeSettingsFormat({
      hooks: {
        PreToolUse: [
          { matcher: 'Write|Edit', hooks: [{ type: 'command', command: 'node check.mjs' }] },
        ],
        Stop: [
          { hooks: [{ command: 'notify.sh', timeout: 10 }] },
        ],
      },
      permissions: {
        allow: ['Bash'],
      },
    })

    expect(result).toEqual({
      hooks: {
        enabled: true,
        events: {
          PreToolUse: [
            { matcher: 'Write|Edit', hooks: [{ command: 'node check.mjs' }] },
          ],
          Stop: [
            { hooks: [{ command: 'notify.sh', timeout: 10 }] },
          ],
        },
      },
    })
  })

  it('drops Claude-only hook events and unrelated settings keys', () => {
    const result = convertToZCodeSettingsFormat({
      hooks: {
        PreCompact: [{ hooks: [{ command: 'compact.sh' }] }],
        Notification: [{ hooks: [{ command: 'notify.sh' }] }],
        SubagentStop: [{ hooks: [{ command: 'sub.sh' }] }],
      },
      model: 'claude-opus',
    })

    expect(result).toEqual({})
  })

  it('returns empty result when source has no hooks or is invalid', () => {
    expect(convertToZCodeSettingsFormat({})).toEqual({})
    expect(convertToZCodeSettingsFormat(undefined)).toEqual({})
    expect(convertToZCodeSettingsFormat({ hooks: [] })).toEqual({})
    expect(convertToZCodeSettingsFormat({ hooks: { PreToolUse: [] } })).toEqual({})
  })
})
