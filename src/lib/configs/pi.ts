import type { ToolConfig } from '../types/config'
import { convertToPiAgent } from '../converters/agent'
import { convertToPiFormat, preservePiServerSettings } from '../converters/mcp'
import { convertToPiPrompt } from '../converters/prompt'

/**
 * Pi (pi-mono) 配置
 *
 * 路径遵循「有跨工具标准的用标准目录，pi 专属的用 ~/.pi/agent/」：
 * - MCP: pi 原生 MCP（0.99+）只读 ~/.pi/agent/mcp.json（用户级）与 .pi/mcp.json（项目级），
 *   不读 ~/.config/mcp/mcp.json；条目结构与 Claude Code 一致，仅为 Figma 等补 oauth.clientName
 *   （见 convertToPiFormat）。装了 pi-mcp-adapter 会整体替换内置 MCP，需从 packages 移除
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
    target: '~/.pi/agent/mcp.json',
    transform: convertToPiFormat,
    preserveExisting: preservePiServerSettings,
  },
  agents: {
    source: '.claude/agents',
    target: '~/.pi/agent/agents',
    transform: convertToPiAgent,
  },
  supported: ['commands', 'skills', 'instructions', 'mcp', 'agents'],
}
