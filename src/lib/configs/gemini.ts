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
  rules: {
    source: '.claude/CLAUDE.md',
    format: 'markdown',
    target: '~/.gemini/GEMINI.md',
    merge: true,
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
  supported: ['commands', 'skills', 'rules', 'mcp', 'agents'],
}
