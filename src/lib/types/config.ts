/**
 * 工具配置类型定义
 */

/**
 * 支持的工具键名
 */
export type ToolKey = 'cursor' | 'claude' | 'codebuddy' | 'opencode' | 'gemini' | 'iflow' | 'codex' | 'zcode' | 'pi' | ({} & string)

/**
 * 配置类型
 */
export type ConfigType = 'commands' | 'skills' | 'instructions' | 'mcp' | 'settings' | 'agents'

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
  target?: string | string[]
  convert?: boolean
  /**
   * 自定义内容转换逻辑 (Custom content transformation logic)
   */
  transform?: (content: string, fileName: string) => string | Promise<string>
}

/**
 * Skills 源过滤策略，所有目标和迁移模式共用
 */
export interface SkillsSyncConfig {
  /**
   * 排除源目录中的顶级条目名称，精确匹配，不支持路径或 glob
   * 显式传入 [] 可取消默认排除；配置数组替换默认列表
   * @default ['synced']
   */
  excludeEntries?: string[]
}

/**
 * 技能配置
 */
export interface SkillConfig {
  source?: string
  target?: string | string[]
  /**
   * 软链接模式：目标 skills 目录中的每个条目以符号链接指向 Claude 源，不再复制内容
   *
   * 目标中已存在的同名复制文件/目录（或指向他处的旧链接）会被删除并替换为软链接；
   * 指向源目录但源已删除的失效链接会被清理；与源无关的条目保持不动
   * 此模式不受 `autoOverwrite` 影响，配置了 `transform` 时自动回退为转换复制
   *
   * @default true
   */
  symlink?: boolean
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
  target?: string | string[]
  /**
   * 自定义内容转换逻辑 (Custom content transformation logic)
   */
  transform?: (content: string, fileName: string) => string | Promise<string>
}

/**
 * 指令文件配置（CLAUDE.md → GEMINI.md / AGENTS.md / CODEBUDDY.md）
 */
export interface InstructionsConfig {
  source?: string
  /** 目标指令文件路径 */
  target?: string | string[]
  /**
   * 自定义内容转换逻辑
   */
  transform?: (content: string, fileName: string) => string | Promise<string>
}

/**
 * MCP配置
 */
export interface MCPConfig {
  source?: string
  target?: string | string[]
  convert?: boolean
  /**
   * 自定义MCP配置转换逻辑 (Custom MCP configuration transformation logic)
   */
  transform?: (config: any) => any | Promise<any>
  /**
   * 转换后、写入前调用：把目标文件里用户在目标工具内改过、源里没有的设置带回转换结果
   * (Carry target-side user settings missing from the source back into the converted result)
   */
  preserveExisting?: (converted: any, existing: any) => any
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
  target?: string | string[]
  /**
   * 合并模式（深度合并现有配置）
   */
  merge?: boolean
  /**
   * 自定义 Settings 转换逻辑（如 ZCode 的 hooks 结构差异）(Custom settings transformation logic)
   */
  transform?: (config: any) => any | Promise<any>
}

/**
 * 工具配置
 */
export interface ToolConfig {
  name: string
  commands: CommandConfig
  skills: SkillConfig
  instructions?: InstructionsConfig
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
    /** Skills 源过滤策略 */
    skills?: SkillsSyncConfig

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
