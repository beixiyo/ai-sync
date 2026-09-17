import type { ToolConfig } from '../types/config'
import { convertToPiAgent } from '../converters/agent'
import { convertToPiPrompt } from '../converters/prompt'

/**
 * Pi (pi-mono) 配置
 *
 * Pi 官方核心极简，MCP 与 subagents 能力来自生态插件，路径遵循
 * 「有跨工具标准的用标准目录，pi 专属的用 ~/.pi/agent/」：
 * - MCP: pi-mcp-adapter 最高优先级读取工具无关标准位 ~/.config/mcp/mcp.json
 *   （mcpServers 结构与 Claude Code 一致，无需转换）
 * - Skills: pi 原生读取 ~/.agents/skills/（Agent Skills 标准，跨工具共享）
 * - Commands: pi 的 prompt templates（~/.pi/agent/prompts/）
 * - Instructions: pi 全局 context 文件（~/.pi/agent/AGENTS.md）
 * - Agents: pi-subagents 插件的 agent 定义（~/.pi/agent/agents/）
 */
export const piConfig: ToolConfig = {
  name: 'Pi',
  commands: {
    source: '.claude/commands',
    format: 'markdown',
    target: '~/.pi/agent/prompts',
    transform: convertToPiPrompt,
  },
  skills: {
    source: '.claude/skills',
    target: '~/.agents/skills',
  },
  instructions: {
    source: '.claude/CLAUDE.md',
    target: '~/.pi/agent/AGENTS.md',
  },
  mcp: {
    source: '.claude.json',
    target: '~/.config/mcp/mcp.json',
  },
  agents: {
    source: '.claude/agents',
    target: '~/.pi/agent/agents',
    transform: convertToPiAgent,
  },
  supported: ['commands', 'skills', 'instructions', 'mcp', 'agents'],
}
