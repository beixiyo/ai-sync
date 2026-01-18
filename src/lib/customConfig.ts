/**
 * 自定义配置支持
 * 允许用户通过 ai-sync.config.js 文件自定义迁移配置
 */

import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { resolve } from 'path'
import {
  type ToolKey,
  type ToolConfig,
  TOOL_CONFIGS,
  defineConfig,
  type SyncConfig,
  INTERNAL_CONFIG
} from './config'
import { deepMerge, isObj } from './utils/deepMerge'

/**
 * 查找配置文件
 */
export async function findConfigFile(cwd: string = process.cwd()): Promise<string | null> {
  const configPath = resolve(cwd, 'ai-sync.config.js')

  if (existsSync(configPath)) {
    return configPath
  }

  return null
}

/**
 * 加载用户配置
 */
export async function loadUserConfig(cwd: string = process.cwd()): Promise<SyncConfig> {
  let userConfig: SyncConfig = {}

  // 尝试从 ai-sync.config.js 加载配置
  const configPath = await findConfigFile(cwd)
  if (configPath) {
    try {
      let config = await import(configPath)
      config = config.default || config || {}

      if (typeof config === 'function') {
        // 提供函数参数，可以细粒度地自定义 (Provide function parameters for fine-grained customization)
        userConfig = await config(INTERNAL_CONFIG)
      } else {
        userConfig = config
      }
    } catch (error) {
      console.error('加载配置文件失败 (Failed to load config file):', error)
    }
  }

  // 尝试从 package.json 加载 ai-sync 配置
  try {
    const packageJsonPath = resolve(cwd, 'package.json')
    if (existsSync(packageJsonPath)) {
      const packageJsonContent = await readFile(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(packageJsonContent)

      if (packageJson['ai-sync']?.configDir) {
        // 合并 package.json 中的配置到用户配置
        if (!userConfig.global) {
          userConfig.global = {}
        }
        userConfig.global.defaultConfigDir = packageJson['ai-sync'].configDir
      }
    }
  } catch (error) {
    console.error('加载 package.json 配置失败 (Failed to load package.json config):', error)
  }

  return userConfig
}

/**
 * 合并配置
 */
export function mergeConfigs(defaultConfig: SyncConfig, userConfig: SyncConfig): SyncConfig {
  return deepMerge(defaultConfig, userConfig)
}

