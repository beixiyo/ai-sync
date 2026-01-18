import type { ToolConfig } from '../types/config'

export const iflowConfig: ToolConfig = {
  name: 'IFlow CLI',
  commands: {
    source: '.claude/commands',
    format: 'toml',
    target: '~/.iflow/commands',
    convert: true
  },
  skills: {
    source: '.claude/skills',
    target: '~/.iflow/skills'
  },
  rules: {
    source: '.cursor/rules',
    format: 'markdown',
    target: '~/.iflow/IFLOW.md',
    merge: true
  },
  mcp: {
    source: '.claude.json',
    target: '~/.iflow/settings.json',
    convert: true
  },
  supported: ['commands', 'skills', 'rules', 'mcp']
}
