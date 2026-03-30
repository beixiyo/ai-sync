import type { ToolConfig } from '../types/config'
import { convertToUniversalAgent } from '../converters/agent'
import { convertToGeminiFormat } from '../converters/mcp'

export const iflowConfig: ToolConfig = {
  name: 'IFlow CLI',
  commands: {
    source: '.claude/commands',
    format: 'toml',
    target: '~/.iflow/commands',
    convert: true,
  },
  skills: {
    source: '.claude/skills',
    target: '~/.iflow/skills',
  },
  instructions: {
    source: '.claude/CLAUDE.md',
    target: '~/.iflow/IFLOW.md',
  },
  mcp: {
    source: '.claude.json',
    target: '~/.iflow/settings.json',
    convert: true,
    transform: convertToGeminiFormat,
  },
  agents: {
    source: '.claude/agents',
    target: '~/.iflow/agents',
    transform: convertToUniversalAgent,
  },
  supported: ['commands', 'skills', 'instructions', 'mcp', 'agents'],
}
