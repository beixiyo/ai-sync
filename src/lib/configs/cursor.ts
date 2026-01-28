import type { ToolConfig } from '../types/config'

export const cursorConfig: ToolConfig = {
  name: 'Cursor',
  commands: {
    source: '.claude/commands',
    format: 'markdown',
    target: '~/.cursor/commands',
  },
  skills: {
    source: '.claude/skills',
    target: '~/.cursor/skills',
  },
  mcp: {
    source: '.claude.json',
    target: '~/.cursor/mcp.json',
    convert: true,
  },
  agents: {
    source: '.claude/agents',
    target: '~/.cursor/agents',
  },
  supported: ['commands', 'skills', 'mcp', 'agents'],
}
