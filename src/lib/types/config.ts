/**
 * 工具配置类型定义
 */

/**
 * 支持的工具键名
 */
export type ToolKey = 'cursor' | 'claude' | 'codebuddy' | 'opencode' | 'gemini' | 'iflow' | 'codex' | ({} & string)

/**
 * 配置类型
 */
export type ConfigType = 'commands' | 'skills' | 'rules' | 'mcp' | 'settings' | 'agents'

/**
 * 文件格式类型
 */
export type FormatType = 'markdown' | 'toml' | 'mdc' | 'json'

/**
 * 配置目录类型 (Config directory type)
 */
export type ConfigDirType = 'global' | 'project'

/**
 * 命令配置
 */
export interface CommandConfig {
  source?: string
  format?: FormatType
  target?: string
  convert?: boolean
  /**
   * 自定义内容转换逻辑 (Custom content transformation logic)
   */
  transform?: (content: string, fileName: string) => string | Promise<string>
}

/**
 * 技能配置
 */
export interface SkillConfig {
  source?: string
  target?: string
  /**
   * 自定义内容转换逻辑 (Custom content transformation logic)
   */
  transform?: (content: string, fileName: string) => string | Promise<string>
}

/**
 * Agent 配置
 */
export interface AgentConfig {
  source?: string
  target?: string
  /**
   * 自定义内容转换逻辑 (Custom content transformation logic)
   */
  transform?: (content: string, fileName: string) => string | Promise<string>
}

/**
 * 规则配置
 */
export interface RuleConfig {
  source?: string
  format?: FormatType
  target?: string
  merge?: boolean
  /**
   * 自定义单个文件转换逻辑 (Custom single file transformation logic)
   */
  transform?: (content: string, fileName: string) => string | Promise<string>
  /**
   * 自定义目录合并逻辑 (Custom directory merge logic)
   */
  customMerge?: (sourceDir: string, targetFile: string) => void | Promise<void>
}

/**
 * MCP配置
 */
export interface MCPConfig {
  source?: string
  target?: string
  convert?: boolean
  /**
   * 自定义MCP配置转换逻辑 (Custom MCP configuration transformation logic)
   */
  transform?: (config: any) => any | Promise<any>
}

/**
 * Local MCP配置
 */
export interface LocalMCPConfig {
  command: string | string[]
  args?: string[]
  env?: Record<string, string>
  enabled?: boolean
  type?: 'local'
}

/**
 * Remote MCP配置
 */
export interface RemoteMCPConfig {
  url?: string
  httpUrl?: string
  type?: 'http' | 'remote' | 'streamable-http'
  headers?: Record<string, string>
  enabled?: boolean
}

/**
 * MCP服务器配置
 */
export type MCPServerConfig = LocalMCPConfig | RemoteMCPConfig

/**
 * Settings 配置（包含 Hooks 和 Permissions）
 */
export interface SettingsConfig {
  source?: string
  target?: string
  /**
   * 合并模式（深度合并现有配置）
   */
  merge?: boolean
}

/**
 * 工具配置
 */
export interface ToolConfig {
  name: string
  commands: CommandConfig
  skills: SkillConfig
  rules?: RuleConfig
  mcp: MCPConfig
  settings?: SettingsConfig
  agents?: AgentConfig
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
 * 配置目录选择项 (Config directory choice)
 */
export interface ConfigDirChoice {
  name: string
  value: ConfigDirType
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
 * 完整配置类型
 */
export interface SyncConfig {
  /**
   * 工具配置
   */
  tools?: Record<string, Partial<ToolConfig>>

  /**
   * 全局配置
   */
  global?: {
    /**
     * 默认源目录
     */
    defaultSourceDir?: string

    /**
     * 默认配置目录
     */
    defaultConfigDir?: string

    /**
     * 默认目标工具
     */
    defaultTargetTools?: ToolKey[]
  }
}

/**
 * 配置定义函数类型
 */
export type ConfigFn = (defaultConfig: SyncConfig) => SyncConfig | Promise<SyncConfig>
