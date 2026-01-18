import type { SyncConfig } from '@lib/config'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { defineConfig, INTERNAL_CONFIG } from '@lib/config'
import { loadUserConfig, mergeConfigs } from '@lib/customConfig'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

/** 模拟项目根目录 */
const testProjectRoot = join(process.cwd(), 'test-project')

/** 清理测试目录 */
async function cleanupTestDir() {
  if (existsSync(testProjectRoot)) {
    rmSync(testProjectRoot, { recursive: true, force: true })
  }
}

describe('customConfig', () => {
  beforeEach(async () => {
    await cleanupTestDir()
    mkdirSync(testProjectRoot, { recursive: true })
  })

  afterAll(async () => {
    await cleanupTestDir()
  })

  describe('loadUserConfig', () => {
    it('should return empty config when no config file or package.json config exists', async () => {
      const config = await loadUserConfig(testProjectRoot)
      /** 预期应该为空 */
      expect(config.tools).toBeUndefined()
      expect(config.global).toBeUndefined()
    })

    it('should load custom config from ai-sync.config.js', async () => {
      const configPath = join(testProjectRoot, 'ai-sync.config.js')
      const customConfig = `
module.exports = {
  global: {
    defaultSourceDir: './my-rules'
  },
  tools: {
    'test-cli': {
      name: 'Test CLI'
    }
  }
}
`
      await writeFile(configPath, customConfig, 'utf-8')
      const config = await loadUserConfig(testProjectRoot)
      expect(config.global?.defaultSourceDir).toBe('./my-rules')
      expect(config.tools?.['test-cli']).toBeDefined()
    })

    it('should load custom config from ai-sync.config.js using functional defineConfig', async () => {
      const functionalProjectRoot = join(testProjectRoot, 'functional')
      mkdirSync(functionalProjectRoot, { recursive: true })
      const configPath = join(functionalProjectRoot, 'ai-sync.config.js')
      const customConfig = `
module.exports = (defaultConfig) => {
  return {
    ...defaultConfig,
    global: {
      defaultSourceDir: './functional-rules'
    }
  }
}
`
      await writeFile(configPath, customConfig, 'utf-8')
      const config = await loadUserConfig(functionalProjectRoot)
      expect(config.global?.defaultSourceDir).toBe('./functional-rules')
      expect(config.tools).toBeDefined()
      expect(config.tools?.cursor).toBeDefined()
    })

    it('should load custom config from explicit path', async () => {
      const explicitProjectRoot = join(testProjectRoot, 'explicit')
      mkdirSync(explicitProjectRoot, { recursive: true })
      const hiddenDir = join(explicitProjectRoot, '.hidden')
      mkdirSync(hiddenDir, { recursive: true })
      const configPath = join(hiddenDir, 'custom-sync.config.js')
      const customConfig = `
module.exports = {
  global: {
    defaultSourceDir: './hidden-rules'
  }
}
`
      await writeFile(configPath, customConfig, 'utf-8')
      const config = await loadUserConfig(explicitProjectRoot, configPath)
      expect(config.global?.defaultSourceDir).toBe('./hidden-rules')
    })

    it('should load custom config from package.json', async () => {
      /** 备份原 package.json */
      const originalPackageJsonPath = join(process.cwd(), 'package.json')
      const originalContent = await readFile(originalPackageJsonPath, 'utf-8')
      const originalPackageJson = JSON.parse(originalContent)

      /** 修改 package.json 添加 ai-sync 配置 */
      const modifiedPackageJson = {
        ...originalPackageJson,
        'ai-sync': {
          configDir: './custom-config',
        },
      }

      await writeFile(originalPackageJsonPath, JSON.stringify(modifiedPackageJson, null, 2), 'utf-8')

      try {
        /** 加载配置 */
        const config = await loadUserConfig()
        /** 验证配置加载成功 */
        expect(config.global?.defaultConfigDir).toBe('./custom-config')
      }
      finally {
        /** 恢复原 package.json */
        await writeFile(originalPackageJsonPath, JSON.stringify(originalPackageJson, null, 2), 'utf-8')
      }
    })
  })

  describe('mergeConfigs', () => {
    it('should merge custom tool config with default config', () => {
      /** 创建自定义配置 */
      const customConfig: SyncConfig = {
        tools: {
          'test-cli': {
            name: 'Test CLI',
            commands: {
              source: '.test-cli/commands',
              format: 'markdown',
              target: '~/.test-cli/commands',
            },
            supported: ['commands'],
          } as any,
          /** 修改现有工具配置 */
          'cursor': {
            name: 'Custom Cursor',
          },
        },
      }

      /** 合并配置 */
      const merged = mergeConfigs(INTERNAL_CONFIG, customConfig)

      /** 验证自定义工具添加成功 */
      expect(merged.tools?.['test-cli']).toBeDefined()
      expect(merged.tools?.['test-cli']?.name).toBe('Test CLI')
      expect(merged.tools?.['test-cli']?.commands?.source).toBe('.test-cli/commands')
      expect(merged.tools?.['test-cli']?.supported).toEqual(['commands'])

      /** 验证现有工具配置修改成功 */
      expect(merged.tools?.cursor?.name).toBe('Custom Cursor')
      /** 验证现有工具其他配置保持不变 */
      expect(merged.tools?.cursor?.supported).toEqual(['commands', 'skills', 'rules', 'mcp'])
    })

    it('should merge global config', () => {
      const customConfig: SyncConfig = {
        global: {
          defaultSourceDir: './custom-rules',
        },
      }

      const merged = mergeConfigs(INTERNAL_CONFIG, customConfig)

      expect(merged.global?.defaultSourceDir).toBe('./custom-rules')
      expect(merged.tools).toEqual(INTERNAL_CONFIG.tools)
    })
  })

  describe('defineConfig', () => {
    it('should return the same config object', () => {
      const config: SyncConfig = {
        global: {
          defaultSourceDir: './my-rules',
        },
      }

      const definedConfig = defineConfig(config)

      expect(definedConfig).toBe(config)
      expect(definedConfig).toEqual(config)
    })

    it('should return the same function', () => {
      const configFn = (config: SyncConfig) => config
      const definedConfig = defineConfig(configFn)
      expect(definedConfig).toBe(configFn)
    })

    it('should work with custom transform function', async () => {
      const config: SyncConfig = {
        tools: {
          cursor: {
            rules: {
              transform: (content: string) => `${content}\n# Custom Rule Suffix`,
            },
          },
        },
      }

      const merged = mergeConfigs(INTERNAL_CONFIG, config)
      expect(merged.tools?.cursor?.rules?.transform).toBeDefined()

      const transformed = await (merged.tools?.cursor?.rules?.transform as any)('Original Content', 'test.md')
      expect(transformed).toBe('Original Content\n# Custom Rule Suffix')
    })

    it('should work with custom tool definition', () => {
      const customConfig = defineConfig({
        tools: {
          'test-cli': {
            name: 'Test CLI',
            commands: {
              source: '.test-cli/commands',
              format: 'markdown',
              target: '~/.test-cli/commands',
            },
            skills: {
              source: '.test-cli/skills',
              target: '~/.test-cli/skills',
            },
            rules: {
              source: '.test-cli/rules',
              format: 'markdown',
              target: '~/.test-cli/RULES.md',
              merge: true,
            },
            mcp: {
              source: '.test-cli.json',
              target: '~/.test-cli/settings.json',
            },
            supported: ['commands', 'skills', 'rules', 'mcp'],
          },
        },
      }) as SyncConfig

      expect(customConfig.tools?.['test-cli']).toBeDefined()
      expect(customConfig.tools?.['test-cli']?.name).toBe('Test CLI')
      expect(customConfig.tools?.['test-cli']?.commands?.format).toBe('markdown')
      expect(customConfig.tools?.['test-cli']?.rules?.merge).toBe(true)
    })

    it('should have built-in codex support', () => {
      expect(INTERNAL_CONFIG.tools?.codex).toBeDefined()
      expect(INTERNAL_CONFIG.tools?.codex?.name).toBe('Codex')
    })
  })
})
