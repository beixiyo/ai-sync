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
  instructions: {
    source: '.claude/CLAUDE.md',
    target: '~/.config/opencode/AGENTS.md',
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
  supported: ['commands', 'skills', 'instructions', 'mcp', 'agents'],
}
