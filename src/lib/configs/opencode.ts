import type { ToolConfig } from '../types/config'
import { convertToOpenCodeAgent } from '../converters/agent'
import { convertToOpenCodeFormat } from '../converters/mcp'

export const opencodeConfig: ToolConfig = {
  name: 'OpenCode',
  commands: {
    source: '.claude/commands',
    format: 'markdown',
    target: '~/.config/opencode/commands',
  },
  skills: {
    source: '.claude/skills',
    target: '~/.config/opencode/skills',
  },
  rules: {
    source: '.claude/CLAUDE.md',
    format: 'markdown',
    target: '~/.config/opencode/AGENTS.md',
    merge: true,
  },
  mcp: {
    source: '.claude.json',
    target: ['~/.config/opencode/opencode.jsonc', '~/.config/opencode/opencode.json'],
    convert: true,
    transform: convertToOpenCodeFormat,
  },
  agents: {
    source: '.claude/agents',
    target: '~/.config/opencode/agents',
    transform: convertToOpenCodeAgent,
  },
  supported: ['commands', 'skills', 'rules', 'mcp', 'agents'],
}
