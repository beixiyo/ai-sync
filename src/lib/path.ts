/**
 * 路径工具函数
 */

import type { ConfigType, ToolKey } from './config'
import { DEFAULT_TOOL_CONFIGS } from './configs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { fileExists } from './utils/file'

/**
 * 展开家目录路径
 */
export function expandHome(filepath: string): string {
  if (filepath.startsWith('~')) {
    return join(homedir(), filepath.slice(1))
  }
  return filepath
}

/**
 * 获取工具配置路径 (统一且唯一从配置中心读取)
 * 不再包含任何 Fallback 猜测，完全由 ToolConfig 驱动
 * 注意：由于涉及数组探测，此同步版本仅返回第一个配置值
 */
export function getToolPath(
  tool: ToolKey,
  configType: ConfigType,
): string {
  const toolConfig = DEFAULT_TOOL_CONFIGS[tool]
  const typeConfig = toolConfig?.[configType] as any

  if (!typeConfig?.target) {
    /** 只有在完全没有配置时才使用极简默认值 (仅作为系统鲁棒性保底) */
    return expandHome(`~/.${tool}/${configType === 'mcp' ? 'mcp.json' : configType}`)
  }

  const target = typeConfig.target
  const firstPath = Array.isArray(target) ? target[0] : target
  return expandHome(firstPath)
}

/**
 * 异步解析最终目标路径 (支持数组动态探测)
 */
export async function resolveTargetPath(
  tool: ToolKey,
  configType: ConfigType,
): Promise<string> {
  const toolConfig = DEFAULT_TOOL_CONFIGS[tool]
  const typeConfig = toolConfig?.[configType] as any

  if (!typeConfig?.target) {
    return getToolPath(tool, configType)
  }

  const target = typeConfig.target
  if (!Array.isArray(target)) {
    return expandHome(target)
  }

  /** 如果是数组，按顺序探测磁盘 */
  for (const p of target) {
    const expanded = expandHome(p)
    if (existsSync(expanded)) {
      return expanded
    }
  }

  /** 如果都不存在，返回第一个作为默认 */
  return expandHome(target[0])
}

/**
 * 规范化路径
 */
export function normalizePath(filepath: string): string {
  return filepath.replace(/\\/g, '/')
}

/**
 * 探测并获取最终的源目录
 */
export async function resolveSourceDir(
  providedSourceDir: string | undefined,
  _defaultConfigDir: string,
): Promise<string> {
  if (providedSourceDir) {
    const resolvedPath = resolve(expandHome(providedSourceDir))
    if (basename(resolvedPath) === '.claude') {
      return dirname(resolvedPath)
    }
    return resolvedPath
  }
  return homedir()
}

/**
 * 获取 MCP 源路径
 */
export async function getMCPSourcePath(sourceDir: string): Promise<string> {
  return resolve(sourceDir, '.claude.json')
}

/**
 * 获取 OpenCode 配置文件路径 (动态探测逻辑)
 * 用于当配置虽然定义了 target，但需要检查磁盘上是否存在已有的 alternative 格式
 */
export async function getOpenCodeMCPPath(basePath: string): Promise<string> {
  const jsonCPath = join(basePath, 'opencode.jsonc')
  const jsonPath = join(basePath, 'opencode.json')

  if (await fileExists(jsonCPath)) return jsonCPath
  if (await fileExists(jsonPath)) return jsonPath

  return jsonCPath // 默认返回 jsonc
}

export async function getCommandsSourcePath(sourceDir: string): Promise<string> {
  return resolve(sourceDir, '.claude/commands')
}

export async function getSkillsSourcePath(sourceDir: string): Promise<string> {
  return resolve(sourceDir, '.claude/skills')
}

export async function getAgentsSourcePath(sourceDir: string): Promise<string> {
  return resolve(sourceDir, '.claude/agents')
}

export async function getSettingsSourcePath(sourceDir: string): Promise<string> {
  return resolve(sourceDir, '.claude/settings.json')
}

export async function getRuleSourcePath(sourceDir: string): Promise<string> {
  const priorityFiles = ['CLAUDE.md', 'AGENTS.md']
  for (const fileName of priorityFiles) {
    const filePath = resolve(sourceDir, '.claude', fileName)
    if (await fileExists(filePath)) return filePath
  }
  for (const fileName of priorityFiles) {
    const filePath = resolve(sourceDir, fileName)
    if (await fileExists(filePath)) return filePath
  }
  return resolve(sourceDir, '.claude', 'CLAUDE.md')
}
