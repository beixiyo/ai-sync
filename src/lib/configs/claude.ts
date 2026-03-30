import type { ToolConfig } from '../types/config'

export const claudeConfig: ToolConfig = {
  name: 'Claude Code',
  commands: {
    source: '.claude/commands',
    format: 'markdown',
    target: '~/.claude/commands',
  },
  skills: {
    source: '.claude/skills',
    target: '~/.claude/skills',
  },
  mcp: {
    source: '.claude.json',
    target: '~/.claude.json',
  },
  settings: {
    source: '.claude/settings.json',
    target: '~/.claude/settings.json',
    merge: true,
  },
  agents: {
    source: '.claude/agents',
    target: '~/.claude/agents',
  },
  supported: ['commands', 'skills', 'mcp', 'settings', 'agents'],
}
