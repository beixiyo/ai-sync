/**
 * 路径工具函数
 */

import { homedir } from 'os'
import { join, resolve } from 'path'
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
    }
  }

  const basePath = isProject
    ? resolve(projectDir, paths[tool].project)
    : expandHome(paths[tool].global)

  return join(basePath, configType)
}

/**
 * 规范化路径（统一使用正斜杠）
 */
export function normalizePath(filepath: string): string {
  return filepath.replace(/\\/g, '/')
}