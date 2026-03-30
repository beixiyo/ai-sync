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
  instructions: {
    source: '.claude/CLAUDE.md',
    target: '~/.codebuddy/CODEBUDDY.md',
  },
  mcp: {
    source: '.claude.json',
    target: '~/.codebuddy/.mcp.json',
  },
  settings: {
    source: '.claude/settings.json',
    target: '~/.codebuddy/settings.json',
    merge: true,
  },
  agents: {
    source: '.claude/agents',
    target: '~/.codebuddy/agents',
  },
  supported: ['commands', 'skills', 'instructions', 'mcp', 'settings', 'agents'],
}
