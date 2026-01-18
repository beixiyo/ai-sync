import type { ToolConfig } from '../types/config'

export const claudeConfig: ToolConfig = {
  name: 'Claude Code',
  commands: {
    source: '.claude/commands',
    format: 'markdown',
    target: '~/.claude/commands'
  },
  skills: {
    source: '.claude/skills',
    target: '~/.claude/skills'
  },
  rules: {
    source: '.cursor/rules',
    format: 'markdown',
    target: '~/.claude/CLAUDE.md',
    merge: true
  },
  mcp: {
    source: '.claude.json',
    target: '~/.claude/.claude.json'
  },
  supported: ['commands', 'skills', 'rules', 'mcp']
}
