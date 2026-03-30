import type { ToolConfig } from '../types/config'
import { convertToUniversalAgent } from '../converters/agent'
import { convertToGeminiFormat } from '../converters/mcp'

export const geminiConfig: ToolConfig = {
  name: 'Gemini CLI',
  commands: {
    source: '.claude/commands',
    format: 'toml',
    target: '~/.gemini/commands',
    convert: true,
  },
  skills: {
    source: '.claude/skills',
    target: '~/.gemini/skills',
  },
  instructions: {
    source: '.claude/CLAUDE.md',
    target: '~/.gemini/GEMINI.md',
  },
  mcp: {
    source: '.claude.json',
    target: '~/.gemini/settings.json',
    convert: true,
    transform: convertToGeminiFormat,
  },
  agents: {
    source: '.claude/agents',
    target: '~/.gemini/agents',
    transform: convertToUniversalAgent,
  },
  supported: ['commands', 'skills', 'instructions', 'mcp', 'agents'],
}
