/**
 * 路径工具函数
 */

import { homedir } from 'os'
import { join, resolve } from 'path'
import { access, stat } from 'fs/promises'
import type { ToolKey, ConfigType } from './config'

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
  projectDir: string = ''
): string {
  const paths: Record<ToolKey, { global: string; project: string }> = {
    cursor: {
      global: '~/.cursor',
      project: '.cursor'
    },
    claude: {
      global: '~/.claude',
      project: '.claude'
    },
    opencode: {
      global: '~/.config/opencode',
      project: '.opencode'
    },
    gemini: {
      global: '~/.gemini',
      project: '.gemini'
    },
    iflow: {
      global: '~/.iflow',
      project: '.iflow'
    },
    codex: {
      global: '~/.codex',
      project: '.codex'
    }
  }

  // 为自定义工具提供默认路径
  const toolPath = paths[tool as string] || {
    global: `~/.${tool}`,
    project: `.${tool}`
  }

  const basePath = isProject
    ? resolve(projectDir, toolPath.project)
    : expandHome(toolPath.global)

  // 为 OpenCode 特殊处理路径，保持 command/skill 的单数形式
  if (tool === 'opencode') {
    if (configType === 'commands') return join(basePath, 'command')
    if (configType === 'skills') return join(basePath, 'skill')
    if (configType === 'mcp') return join(basePath, 'opencode.jsonc')
  }

  // 为 Codex 特殊处理路径
  if (tool === 'codex') {
    if (configType === 'commands') return join(basePath, 'prompts')
    if (configType === 'mcp') return join(basePath, 'config.toml')
  }

  // 为 MCP 配置特殊处理路径
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
  defaultConfigDir: string
): Promise<string> {
  const sourceDir = providedSourceDir || defaultConfigDir

  if (await dirExists(sourceDir)) {
    return sourceDir
  }

  // 如果默认目录不存在，检查当前项目的 .claude 目录
  const projectClaudeDir = resolve(process.cwd(), '.claude')
  if (await dirExists(projectClaudeDir)) {
    return projectClaudeDir
  }

  throw new Error(`源目录不存在 (Source directory not found): ${sourceDir}\n且当前项目的 .claude 目录也不存在`)
}

/**
 * 检查文件是否存在
 */
async function fileExists(filepath: string): Promise<boolean> {
  try {
    const stats = await stat(filepath)
    return stats.isFile()
  } catch {
    return false
  }
}

/**
 * 检查目录是否存在
 */
async function dirExists(dirpath: string): Promise<boolean> {
  try {
    const stats = await stat(dirpath)
    return stats.isDirectory()
  } catch {
    return false
  }
}

/**
 * 获取规则源路径（按照优先级检测）
 * 优先级顺序：
 * 1. 根目录下的 AGENTS.md、AGENT.md、CLAUDE.md 文件
 * 2. .claude/ 目录下的文件
 * 3. .cursor/rules 目录
 */
export async function getRuleSourcePath(sourceDir: string): Promise<string> {
  // 1. 检测根目录下的优先级文件
  const priorityFiles = ['AGENTS.md', 'AGENT.md', 'CLAUDE.md']

  for (const fileName of priorityFiles) {
    const filePath = resolve(sourceDir, fileName)
    if (await fileExists(filePath)) {
      return filePath
    }
  }

  // 2. 检测 .claude/ 目录
  const claudeRulesDir = resolve(sourceDir, '.claude')
  if (await dirExists(claudeRulesDir)) {
    return claudeRulesDir
  }

  // 3. 检测 .cursor/rules 目录作为后备
  const cursorRulesDir = resolve(sourceDir, '.cursor/rules')
  if (await dirExists(cursorRulesDir)) {
    return cursorRulesDir
  }

  // 4. 默认使用 .cursor/rules 目录
  return cursorRulesDir
}