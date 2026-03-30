import type { ToolConfig } from '../types/config'
import { convertToUniversalAgent } from '../converters/agent'
import { convertToCodexFormat } from '../converters/mcp'

export const codexConfig: ToolConfig = {
  name: 'Codex',
  commands: {
    source: '.claude/commands',
    format: 'markdown',
    target: '~/.codex/prompts',
  },
  skills: {
    source: '.claude/skills',
    target: '~/.codex/skills',
  },
  instructions: {
    source: '.claude/CLAUDE.md',
    target: '~/.codex/AGENTS.md',
  },
  mcp: {
    source: '.claude.json',
    target: '~/.codex/config.toml',
    convert: true,
    transform: convertToCodexFormat,
  },
  agents: {
    source: '.claude/agents',
    target: '~/.codex/agents',
    transform: convertToUniversalAgent,
  },
  supported: ['commands', 'skills', 'instructions', 'mcp', 'agents'],
}
