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
  rules: {
    source: '.claude/CLAUDE.md',
    format: 'mdc',
    target: '~/.cursor/rules',
  },
  mcp: {
    source: '.claude.json',
    target: '~/.cursor/mcp.json',
    convert: true,
  },
  supported: ['commands', 'skills', 'rules', 'mcp'],
}
