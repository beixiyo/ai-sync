/**
 * 路径工具函数
 */

import type { ConfigType, ToolKey } from './config'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
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
 * 获取工具配置路径
 */
export function getToolPath(
  tool: ToolKey,
  configType: ConfigType,
  isProject: boolean = false,
  projectDir: string = '',
): string {
  const paths: Record<ToolKey, string> = {
    cursor: '~/.cursor',
    claude: '~/.claude',
    opencode: '~/.config/opencode',
    gemini: '~/.gemini',
    iflow: '~/.iflow',
    codex: '~/.codex',
  }

  /** 为自定义工具提供默认路径 */
  const toolPath = paths[tool as string] || `~/.${tool}`

  const basePath = isProject
    ? resolve(projectDir, toolPath.startsWith('~/')
        ? toolPath.slice(2)
        : toolPath)
    : expandHome(toolPath)

  /** 为 OpenCode 特殊处理路径，保持 command/skill 的单数形式 */
  if (tool === 'opencode') {
    if (configType === 'commands')
      return join(basePath, 'command')
    if (configType === 'skills')
      return join(basePath, 'skill')
    if (configType === 'mcp')
      return join(basePath, 'opencode.jsonc')
  }

  /** 为 Codex 特殊处理路径 */
  if (tool === 'codex') {
    if (configType === 'commands')
      return join(basePath, 'prompts')
    if (configType === 'mcp')
      return join(basePath, 'config.toml')
  }

  /** 为 MCP 配置特殊处理路径 */
  if (configType === 'mcp') {
    switch (tool) {
      case 'cursor':
        return join(basePath, 'mcp.json')
      case 'claude':
        return join(basePath, '.claude.json')
      case 'gemini':
        return join(basePath, 'settings.json')
      case 'iflow':
        return join(basePath, 'settings.json')
      default:
        return join(basePath, 'mcp.json')
    }
  }

  return join(basePath, configType)
}

/**
 * 规范化路径（统一使用正斜杠）
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
  // 1. 如果提供了源目录，直接使用
  if (providedSourceDir) {
    const resolvedPath = resolve(expandHome(providedSourceDir))
    /** 如果指向的是 .claude 目录，返回其父目录作为 Root */
    if (basename(resolvedPath) === '.claude') {
      return dirname(resolvedPath)
    }
    return resolvedPath
  }

  // 2. 默认使用家目录中的 .claude 所在目录
  return homedir()
}

/**
 * 获取 MCP 源路径（统一使用 .claude.json）
 */
export async function getMCPSourcePath(sourceDir: string): Promise<string> {
  /** 优先从 .claude.json 读取 */
  const filePath = resolve(sourceDir, '.claude.json')
  if (await fileExists(filePath)) {
    return filePath
  }

  /** 默认返回第一个，用于后续错误展示 */
  return filePath
}

/**
 * 获取 OpenCode 配置文件路径（检测 .jsonc 或 .json）
 */
export async function getOpenCodeMCPPath(basePath: string): Promise<string> {
  // 1. 优先检测 .jsonc（OpenCode 推荐格式）
  const jsonCPath = join(basePath, 'opencode.jsonc')
  if (await fileExists(jsonCPath)) {
    return jsonCPath
  }

  // 2. 其次检测 .json
  const jsonPath = join(basePath, 'opencode.json')
  if (await fileExists(jsonPath)) {
    return jsonPath
  }

  // 3. 都不存在时，默认返回 .jsonc
  return jsonCPath
}

/**
 * 获取命令源路径
 */
export async function getCommandsSourcePath(sourceDir: string): Promise<string> {
  const claudePath = resolve(sourceDir, '.claude/commands')
  return claudePath
}

/**
 * 获取技能源路径
 */
export async function getSkillsSourcePath(sourceDir: string): Promise<string> {
  const claudePath = resolve(sourceDir, '.claude/skills')
  return claudePath
}

/**
 * 获取规则源路径（按照优先级检测）
 * 优先级顺序：
 * 1. .claude/ 目录下的 CLAUDE.md, AGENTS.md 文件
 * 2. 根目录下的 CLAUDE.md, AGENTS.md 文件
 */
export async function getRuleSourcePath(sourceDir: string): Promise<string> {
  // 1. 优先检测 .claude/ 目录
  const priorityFiles = ['CLAUDE.md', 'AGENTS.md']

  for (const fileName of priorityFiles) {
    const filePath = resolve(sourceDir, '.claude', fileName)
    if (await fileExists(filePath)) {
      return filePath
    }
  }

  // 2. 检测根目录
  for (const fileName of priorityFiles) {
    const filePath = resolve(sourceDir, fileName)
    if (await fileExists(filePath)) {
      return filePath
    }
  }

  /** 默认返回 .claude/CLAUDE.md */
  return resolve(sourceDir, '.claude', 'CLAUDE.md')
}
