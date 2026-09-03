import type { ToolConfig } from '../types/config'
import { convertToZCodeFormat } from '../converters/mcp'
import { convertToZCodeSettingsFormat } from '../converters/settings'

/**
 * ZCode（智谱 Z.ai Agentic 开发环境）配置
 *
 * - Commands / Skills / Agents 与 Claude Code 格式兼容，直接复制
 * - 指令文件为用户级 `~/.zcode/AGENTS.md`
 * - MCP 写入用户级 `~/.zcode/cli/config.json` 的 `mcp.servers` 嵌套结构（注意多一层 cli/ 目录）
 * - Settings 仅迁移双方兼容的 Hooks 事件，包装为 `hooks.events` 结构并显式启用
 */
export const zcodeConfig: ToolConfig = {
  name: 'ZCode',
  commands: {
    source: '.claude/commands',
    format: 'markdown',
    target: '~/.zcode/commands',
  },
  skills: {
    source: '.claude/skills',
    target: '~/.zcode/skills',
  },
  instructions: {
    source: '.claude/CLAUDE.md',
    target: '~/.zcode/AGENTS.md',
  },
  mcp: {
    source: '.claude.json',
    target: '~/.zcode/cli/config.json',
    convert: true,
    transform: convertToZCodeFormat,
  },
  settings: {
    source: '.claude/settings.json',
    target: '~/.zcode/cli/config.json',
    merge: true,
    transform: convertToZCodeSettingsFormat,
  },
  agents: {
    source: '.claude/agents',
    target: '~/.zcode/agents',
  },
  supported: ['commands', 'skills', 'instructions', 'mcp', 'settings', 'agents'],
}
