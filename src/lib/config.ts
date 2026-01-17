/**
 * 工具配置类型定义
 */

/**
 * 支持的工具键名
 */
export type ToolKey = 'cursor' | 'claude' | 'opencode' | 'gemini' | 'iflow'

/**
 * 配置类型
 */
export type ConfigType = 'commands' | 'skills' | 'rules' | 'hooks'

/**
 * 文件格式类型
 */
export type FormatType = 'markdown' | 'toml' | 'mdc'

/**
 * 作用域类型
 */
export type ScopeType = 'global' | 'project'

/**
 * 命令配置
 */
export interface CommandConfig {
  source: string
  format: FormatType
  target: string
  convert?: boolean
}

/**
 * 技能配置
 */
export interface SkillConfig {
  source: string
  target: string
}

/**
 * 规则配置
 */
export interface RuleConfig {
  source: string
  format: FormatType
  target: string
  merge?: boolean
}

/**
 * 钩子配置
 */
export interface HookConfig {
  source: string
  config: string
  target: string
  convert?: boolean
  supported?: boolean
}

/**
 * 工具配置
 */
export interface ToolConfig {
  name: string
  commands: CommandConfig
  skills: SkillConfig
  rules: RuleConfig
  hooks: HookConfig
  supported: ConfigType[]
}

/**
 * 工具选择项
 */
export interface ToolChoice {
  name: string
  value: ToolKey
}

/**
 * 作用域选择项
 */
export interface ScopeChoice {
  name: string
  value: ScopeType
}

/**
 * 配置类型信息
 */
export interface ConfigTypeInfo {
  name: string
  source: string
  directCopy?: ToolKey[]
  convertToTOML?: ToolKey[]
  mergeToMarkdown?: ToolKey[]
  convert?: ToolKey[]
  config?: string
}

/**
 * 工具配置映射
 */
export const TOOL_CONFIGS: Record<ToolKey, ToolConfig> = {
  cursor: {
    name: 'Cursor',
    commands: {
      source: '.claude/commands',
      format: 'markdown',
      target: '~/.cursor/commands'
    },
    skills: {
      source: '.claude/skills',
      target: '~/.cursor/skills'
    },
    rules: {
      source: '.cursor/rules',
      format: 'mdc',
      target: '~/.cursor/rules'
    },
    hooks: {
      source: '.cursor/hooks',
      config: '.cursor/hooks.json',
      target: '~/.cursor/hooks'
    },
    supported: ['commands', 'skills', 'rules', 'hooks']
  },
  claude: {
    name: 'Claude Code',
    commands: {
      source: '.claude/commands',
      format: 'markdown',
      target: '~/.claude/commands'
    },
    skills: {
      source: '.claude/skills',
      target: '~/.claude/skills'
    },
    rules: {
      source: '.cursor/rules',
      format: 'markdown',
      target: '~/.claude/CLAUDE.md',
      merge: true
    },
    hooks: {
      source: '.cursor/hooks',
      config: '.cursor/hooks.json',
      target: '~/.claude/settings.json',
      convert: true
    },
    supported: ['commands', 'skills', 'rules', 'hooks']
  },
  opencode: {
    name: 'OpenCode',
    commands: {
      source: '.claude/commands',
      format: 'markdown',
      target: '~/.config/opencode/command'
    },
    skills: {
      source: '.claude/skills',
      target: '~/.config/opencode/skill'
    },
    rules: {
      source: '.cursor/rules',
      format: 'markdown',
      target: '~/.config/opencode/AGENTS.md',
      merge: true
    },
    hooks: {
      source: '.cursor/hooks',
      config: '.cursor/hooks.json',
      target: '~/.config/opencode/hooks',
      supported: false
    },
    supported: ['commands', 'skills', 'rules']
  },
  gemini: {
    name: 'Gemini CLI',
    commands: {
      source: '.claude/commands',
      format: 'toml',
      target: '~/.gemini/commands',
      convert: true
    },
    skills: {
      source: '.claude/skills',
      target: '~/.gemini/skills'
    },
    rules: {
      source: '.cursor/rules',
      format: 'markdown',
      target: '~/.gemini/GEMINI.md',
      merge: true
    },
    hooks: {
      source: '.cursor/hooks',
      config: '.cursor/hooks.json',
      target: '~/.gemini/hooks',
      supported: false
    },
    supported: ['commands', 'skills', 'rules']
  },
  iflow: {
    name: 'IFlow CLI',
    commands: {
      source: '.claude/commands',
      format: 'toml',
      target: '~/.iflow/commands',
      convert: true
    },
    skills: {
      source: '.claude/skills',
      target: '~/.iflow/skills'
    },
    rules: {
      source: '.cursor/rules',
      format: 'markdown',
      target: '~/.iflow/IFLOW.md',
      merge: true
    },
    hooks: {
      source: '.cursor/hooks',
      config: '.cursor/hooks.json',
      target: '~/.iflow/hooks',
      supported: false
    },
    supported: ['commands', 'skills', 'rules']
  }
}

/**
 * 配置类型信息映射
 */
export const CONFIG_TYPES: Record<ConfigType, ConfigTypeInfo> = {
  commands: {
    name: 'Commands',
    source: '.claude/commands',
    directCopy: ['cursor', 'claude', 'opencode'],
    convertToTOML: ['gemini', 'iflow']
  },
  skills: {
    name: 'Skills',
    source: '.claude/skills',
    directCopy: ['cursor', 'claude', 'opencode', 'gemini', 'iflow']
  },
  rules: {
    name: 'Rules',
    source: '.cursor/rules',
    directCopy: ['cursor'],
    mergeToMarkdown: ['claude', 'opencode', 'gemini', 'iflow']
  },
  hooks: {
    name: 'Hooks',
    source: '.cursor/hooks',
    config: '.cursor/hooks.json',
    directCopy: ['cursor'],
    convert: ['claude']
  }
}

/**
 * 获取工具选择列表
 */
export function getToolChoiceList(): ToolChoice[] {
  return Object.keys(TOOL_CONFIGS).map((key) => ({
    name: TOOL_CONFIGS[key as ToolKey].name,
    value: key as ToolKey
  }))
}

/**
 * 获取作用域选择列表
 */
export function getScopeChoiceList(): ScopeChoice[] {
  return [
    { name: '全局配置（所有项目共享）', value: 'global' },
    { name: '当前项目配置（仅当前项目）', value: 'project' }
  ]
}

/**
 * 检查工具是否支持指定配置类型
 */
export function isConfigTypeSupported(tool: string, configType: ConfigType): boolean {
  const toolConfig = TOOL_CONFIGS[tool as ToolKey]
  if (!toolConfig) return false
  return toolConfig.supported.includes(configType)
}