import type { ToolConfig } from '../types/config'
import { convertToUniversalAgent } from '../converters/agent'

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
  instructions: {
    source: '.claude/CLAUDE.md',
    target: '~/.cursor/AGENTS.md',
  },
  mcp: {
    source: '.claude.json',
    target: '~/.cursor/mcp.json',
    convert: true,
  },
  agents: {
    source: '.claude/agents',
    target: '~/.cursor/agents',
    transform: convertToUniversalAgent,
  },
  supported: ['commands', 'skills', 'instructions', 'mcp', 'agents'],
}
