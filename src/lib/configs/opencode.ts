import type { ToolConfig } from '../types/config'

export const opencodeConfig: ToolConfig = {
  name: 'OpenCode',
  commands: {
    source: '.claude/commands',
    format: 'markdown',
    target: '~/.config/opencode/command',
  },
  skills: {
    source: '.claude/skills',
    target: '~/.config/opencode/skill',
  },
  rules: {
    source: '.claude/CLAUDE.md',
    format: 'markdown',
    target: '~/.config/opencode/AGENTS.md',
    merge: true,
  },
  mcp: {
    source: '.claude.json',
    target: '~/.config/opencode/opencode.jsonc',
    convert: true,
  },
  supported: ['commands', 'skills', 'rules', 'mcp'],
}
