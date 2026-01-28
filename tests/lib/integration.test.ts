import type { ToolKey } from '@lib/config'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { TOOL_CONFIGS } from '@lib/config'
import { CommandsMigrator } from '@lib/migrators/commands'
import { MCPMigrator } from '@lib/migrators/mcp'
import { RulesMigrator } from '@lib/migrators/rules'
import { SkillsMigrator } from '@lib/migrators/skills'
import { copyDirectory, ensureDirectoryExists, fileExists, removeDirectory, writeJSONFile } from '@lib/utils/file'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** 测试配置 */
const testSourceDir = join(process.cwd(), 'test-data')
const testTargetDir = join(process.cwd(), 'test-output')

/** Mock os module to redirect home directory to test-output */
vi.mock('node:os', async () => {
  const actual = await vi.importActual('node:os') as any
  return {
    ...actual,
    homedir: () => testTargetDir,
  }
})

/** 所有支持的工具 */
const allTools: ToolKey[] = ['cursor', 'claude', 'opencode', 'gemini', 'iflow', 'codex']

/** 添加测试用的自定义工具配置 (模拟使用 defineConfig 定义的场景) */
const testCustomConfig = {
  name: 'Test CLI',
  commands: {
    source: '.claude/commands',
    format: 'markdown',
    target: '~/.test-cli/commands',
    convert: true,
  },
  skills: {
    source: '.claude/skills',
    target: '~/.test-cli/skills',
  },
  rules: {
    source: '.temp/rules',
    format: 'markdown',
    target: '~/.test-cli/RULES.md',
    merge: true,
  },
  mcp: {
    source: '.claude.json',
    target: '~/.test-cli/mcp.json',
  },
  supported: ['commands', 'skills', 'rules', 'mcp'],
}

/** 所有测试工具（包括自定义工具） */
const allToolsWithCustom = [...allTools, 'test-cli' as ToolKey]
;(TOOL_CONFIGS as any)['test-cli'] = testCustomConfig

describe('集成测试 (全面覆盖)', () => {
  beforeEach(async () => {
    /** 1. 每次测试前清空并重新准备环境 */
    await removeDirectory(testTargetDir)
    await ensureDirectoryExists(testTargetDir)

    /** 准备源数据 (.claude 目录) */
    await copyDirectory(join(testSourceDir, '.claude'), join(testTargetDir, '.claude'))

    const sourceClaudeJson = join(testSourceDir, '.claude.json')
    if (await fileExists(sourceClaudeJson)) {
      const fs = await import('node:fs/promises')
      await fs.copyFile(sourceClaudeJson, join(testTargetDir, '.claude.json'))
    }
  })

  describe('基础迁移链路覆盖 (所有工具同步)', () => {
    it('应该成功同步 Commands 到所有工具', async () => {
      const migrator = new CommandsMigrator(join(testTargetDir, '.claude', 'commands'), allToolsWithCustom, { autoOverwrite: true }, TOOL_CONFIGS)
      await migrator.migrate()

      expect(await fileExists(join(testTargetDir, '.cursor', 'commands', 'test-command.md'))).toBe(true)
      expect(await fileExists(join(testTargetDir, '.config', 'opencode', 'commands', 'test-command.md'))).toBe(true)
      expect(await fileExists(join(testTargetDir, '.gemini', 'commands', 'test-command.toml'))).toBe(true)
      expect(await fileExists(join(testTargetDir, '.test-cli', 'commands', 'test-command.md'))).toBe(true)
    })

    it('应该成功同步 Skills 到所有工具', async () => {
      const migrator = new SkillsMigrator(join(testTargetDir, '.claude', 'skills'), allToolsWithCustom, { autoOverwrite: true }, TOOL_CONFIGS)
      await migrator.migrate()

      for (const tool of allToolsWithCustom) {
        let skillPath: string
        if (tool === 'opencode')
          skillPath = join(testTargetDir, '.config', 'opencode', 'skills', 'test-skill.md')
        else if (tool === 'test-cli')
          skillPath = join(testTargetDir, '.test-cli', 'skills', 'test-skill.md')
        else if (tool === 'codex')
          skillPath = join(testTargetDir, '.codex', 'skills', 'test-skill.md')
        else skillPath = join(testTargetDir, `.${tool}`, 'skills', 'test-skill.md')

        expect(await fileExists(skillPath)).toBe(true)
      }
    })
  })

  describe('mCP 合并与非破坏性更新', () => {
    it('应该执行非破坏性合并，保留 MCP 配置文件中的其他键 (如 permissions)', async () => {
      // 1. 预置目标文件，包含额外字段
      const cursorMcpPath = join(testTargetDir, '.cursor', 'mcp.json')
      await ensureDirectoryExists(join(testTargetDir, '.cursor'))
      await writeJSONFile(cursorMcpPath, {
        mcpServers: {
          'existing-server': { command: 'node', args: ['old.js'] },
        },
        permissions: {
          'allow-all': true,
        },
        customSettings: 'important',
      })

      // 2. 执行迁移 (autoOverwrite: false 模式，执行深度合并)
      const migrator = new MCPMigrator(join(testTargetDir, '.claude.json'), ['cursor'], { autoOverwrite: false }, TOOL_CONFIGS)
      await migrator.migrate()

      // 3. 验证
      const content = JSON.parse(await readFile(cursorMcpPath, 'utf-8'))

      /** 核心配置被迁移 (来自 test-data/.claude.json) */
      expect(content.mcpServers['local-mcp']).toBeDefined()
      expect(content.mcpServers['remote-mcp']).toBeDefined()
      /** 原有服务器被保留 (深度合并) */
      expect(content.mcpServers['existing-server']).toBeDefined()
      /** 非相关键被完整保留 */
      expect(content.permissions['allow-all']).toBe(true)
      expect(content.customSettings).toBe('important')
    })

    it('当 autoOverwrite 为 true 时，应该替换 mcpServers 但仍保留其他根键', async () => {
      const geminiSettingsPath = join(testTargetDir, '.gemini', 'settings.json')
      await ensureDirectoryExists(join(testTargetDir, '.gemini'))
      await writeJSONFile(geminiSettingsPath, {
        mcpServers: { old: { command: 'out' } },
        otherRootKey: 'keep-me',
      })

      const migrator = new MCPMigrator(join(testTargetDir, '.claude.json'), ['gemini'], { autoOverwrite: true }, TOOL_CONFIGS)
      await migrator.migrate()

      const content = JSON.parse(await readFile(geminiSettingsPath, 'utf-8'))
      // mcpServers 应该包含新内容
      expect(content.mcpServers['local-mcp']).toBeDefined()
      /** 根级别的其他键应该还在 */
      expect(content.otherRootKey).toBe('keep-me')
    })
  })

  describe('覆盖迁移与冲突处理 (autoOverwrite)', () => {
    it('当 autoOverwrite 为 false 时，不应覆盖已存在的 Rules/Commands', async () => {
      /** 预置一个已存在的文件 */
      const targetPath = join(testTargetDir, '.config', 'opencode', 'AGENTS.md')
      await ensureDirectoryExists(join(testTargetDir, '.config', 'opencode'))
      await writeFile(targetPath, 'original content')

      const sourceDir = join(testTargetDir, '.claude', 'CLAUDE.md')
      const migrator = new RulesMigrator(sourceDir, ['opencode'], { autoOverwrite: false }, TOOL_CONFIGS)
      const result = await migrator.migrate()

      expect(result.skipped).toBeGreaterThan(0)
      const content = await readFile(targetPath, 'utf-8')
      expect(content).toBe('original content')
    })
  })

  describe('各工具路径与格式准确性验证', () => {
    it('openCode 应该使用正确的复数目录名 (commands/skills) 和 .jsonc 扩展名', async () => {
      const migratorC = new CommandsMigrator(join(testTargetDir, '.claude', 'commands'), ['opencode'], { autoOverwrite: true }, TOOL_CONFIGS)
      const migratorM = new MCPMigrator(join(testTargetDir, '.claude.json'), ['opencode'], { autoOverwrite: true }, TOOL_CONFIGS)

      await migratorC.migrate()
      await migratorM.migrate()

      expect(await fileExists(join(testTargetDir, '.config', 'opencode', 'commands', 'test-command.md'))).toBe(true)
      expect(await fileExists(join(testTargetDir, '.config', 'opencode', 'opencode.jsonc'))).toBe(true)
    })

    it('codex 应该使用 prompts 目录和 config.toml', async () => {
      const migratorC = new CommandsMigrator(join(testTargetDir, '.claude', 'commands'), ['codex'], { autoOverwrite: true }, TOOL_CONFIGS)
      const migratorM = new MCPMigrator(join(testTargetDir, '.claude.json'), ['codex'], { autoOverwrite: true }, TOOL_CONFIGS)

      await migratorC.migrate()
      await migratorM.migrate()

      expect(await fileExists(join(testTargetDir, '.codex', 'prompts', 'test-command.md'))).toBe(true)
      expect(await fileExists(join(testTargetDir, '.codex', 'config.toml'))).toBe(true)

      const tomlContent = await readFile(join(testTargetDir, '.codex', 'config.toml'), 'utf-8')
      expect(tomlContent).toContain('[mcp_servers')
    })

    it('gemini/IFlow 应该将 Markdown Commands 转换为 TOML', async () => {
      const migrator = new CommandsMigrator(join(testTargetDir, '.claude', 'commands'), ['gemini', 'iflow'], { autoOverwrite: true }, TOOL_CONFIGS)
      await migrator.migrate()

      const geminiFile = join(testTargetDir, '.gemini', 'commands', 'test-command.toml')
      expect(await fileExists(geminiFile)).toBe(true)
      const content = await readFile(geminiFile, 'utf-8')
      expect(content).toContain('prompt =')
      expect(content).toContain('!{') // Shell 执行语法
    })
  })

  describe('rules 优先级与合并测试', () => {
    it('对于支持 merge 的工具 (如 test-cli)，应该将多规则合并为单文件', async () => {
      /** 准备多规则目录 */
      const rulesSourceDir = join(testTargetDir, '.temp', 'rules')
      await ensureDirectoryExists(rulesSourceDir)
      await writeFile(join(rulesSourceDir, 'rule1.mdc'), '测试规则 1')
      await writeFile(join(rulesSourceDir, 'rule2.mdc'), '测试规则 2')

      const migrator = new RulesMigrator(rulesSourceDir, ['test-cli'], { autoOverwrite: true }, TOOL_CONFIGS)
      await migrator.migrate()

      const rulesPath = join(testTargetDir, '.test-cli', 'RULES.md')
      expect(await fileExists(rulesPath)).toBe(true)
      const content = await readFile(rulesPath, 'utf-8')
      expect(content).toContain('测试规则 1')
      expect(content).toContain('测试规则 2')
    })
  })
})
