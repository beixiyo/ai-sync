import type { ToolConfig } from '../types/config'

export const codebuddyConfig: ToolConfig = {
  name: 'CodeBuddy',
  commands: {
    source: '.claude/commands',
    format: 'markdown',
    target: '~/.codebuddy/commands',
  },
  skills: {
    source: '.claude/skills',
    target: '~/.codebuddy/skills',
  },
  rules: {
    source: '.claude/CLAUDE.md',
    format: 'markdown',
    target: '~/.codebuddy/CODEBUDDY.md',
    merge: true,
  },
  mcp: {
    source: '.claude.json',
    target: '~/.codebuddy/.mcp.json',
  },
  supported: ['commands', 'skills', 'rules', 'mcp'],
}
