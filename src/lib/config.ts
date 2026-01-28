/**
 * 工具配置
 */

import type {
  ConfigDirChoice,
  ConfigFn,
  ConfigType,
  SyncConfig,
  ToolChoice,
  ToolConfig,
  ToolKey,
} from './types/config'
import { DEFAULT_TOOL_CONFIGS } from './configs'

/** 重新导出所有类型 */
export * from './types/config'

/**
 * 项目完整内置配置
 */
export const INTERNAL_CONFIG = {
  tools: DEFAULT_TOOL_CONFIGS,
}

/**
 * 工具配置映射
 */
export const TOOL_CONFIGS: Record<ToolKey, ToolConfig> = INTERNAL_CONFIG.tools as Record<ToolKey, ToolConfig>

/**
 * 获取工具选择列表
 */
export function getToolChoiceList(tools: Record<ToolKey, ToolConfig> = TOOL_CONFIGS): ToolChoice[] {
  return Object.keys(tools).map(key => ({
    name: tools[key as ToolKey].name,
    value: key as ToolKey,
  }))
}

/**
 * 获取配置目录选择列表
 */
export function getConfigDirChoiceList(): ConfigDirChoice[] {
  return [
    { name: '全局配置（所有项目共享） (Global configuration (shared by all projects))', value: 'global' },
    { name: '当前项目配置（仅当前项目） (Current project configuration (only this project))', value: 'project' },
  ]
}

/**
 * 检查工具是否支持指定配置类型
 */
export function isConfigTypeSupported(tool: string, configType: ConfigType, tools: Record<ToolKey, ToolConfig> = TOOL_CONFIGS): boolean {
  const toolConfig = tools[tool as ToolKey]
  if (!toolConfig)
    return false
  return toolConfig.supported.includes(configType)
}

/**
 * defineConfig 函数，用于项目配置定义
 */
export function defineConfig<T extends SyncConfig | ConfigFn>(config: T): T {
  return config
}
