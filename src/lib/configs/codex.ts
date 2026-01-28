import type { ToolConfig } from '../types/config'

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
  rules: {
    source: '.claude/CLAUDE.md',
    format: 'markdown',
    target: '~/.codex/AGENTS.md',
    merge: true,
  },
  mcp: {
    source: '.claude.json',
    target: '~/.codex/config.toml',
    convert: true,
  },
  agents: {
    source: '.claude/agents',
    target: '~/.codex/agents',
  },
  supported: ['commands', 'skills', 'rules', 'mcp', 'agents'],
}
