import type { ToolKey } from '@lib/config'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { TOOL_CONFIGS } from '@lib/config'
import { CommandsMigrator } from '@lib/migrators/commands'
import { MCPMigrator } from '@lib/migrators/mcp'
import { RulesMigrator } from '@lib/migrators/rules'
import { SkillsMigrator } from '@lib/migrators/skills'
import { copyDirectory, fileExists, removeDirectory } from '@lib/utils/file'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

/** 测试配置 */
const testSourceDir = join(process.cwd(), 'test-data')
const testTargetDir = join(process.cwd(), 'test-output')

/** 测试选项 */
const testOptions = {
  isProject: true,
  projectDir: testTargetDir,
  autoOverwrite: true,
}

/** 所有支持的工具 */
const allTools: ToolKey[] = ['cursor', 'claude', 'opencode', 'gemini', 'iflow', 'codex']

/** 添加测试用的自定义工具配置 */
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
    source: '.cursor/rules',
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

/** 在 TOOL_CONFIGS 中添加自定义工具配置 */
;(TOOL_CONFIGS as any)['test-cli'] = testCustomConfig

/** 清理测试环境 */
async function cleanupTestEnvironment() {
  /** 移除测试输出目录 */
  await removeDirectory(testTargetDir)
}

/** 准备测试数据 */
async function setupTestData() {
  /** 复制测试数据到临时目录 */
  await copyDirectory(join(testSourceDir, '.claude'), join(testTargetDir, '.claude'))
  await copyDirectory(join(testSourceDir, '.cursor'), join(testTargetDir, '.cursor'))
  /** 复制 MCP 配置文件 */
  const sourceClaudeJson = join(testSourceDir, '.claude.json')
  const targetClaudeJson = join(testTargetDir, '.claude.json')
  if (await fileExists(sourceClaudeJson)) {
    const fs = await import('node:fs/promises')
    await fs.copyFile(sourceClaudeJson, targetClaudeJson)
  }
}

describe('集成测试', () => {
  /** 测试开始前清理环境并设置测试数据（只执行一次） */
  beforeAll(async () => {
    await cleanupTestEnvironment()
    await setupTestData()
  })

  /** 禁用每个测试用例前的清理操作，保留测试输出目录 */
  beforeEach(async () => {
    /** 仅设置测试数据，不清理环境 */
    await setupTestData()
  })

  describe('claude → 其他工具转换', () => {
    describe('commands 转换', () => {
      it('应该成功将 Claude Commands 转换到所有工具（包括自定义工具）', async () => {
        const sourceDir = join(testTargetDir, '.claude', 'commands')
        const migrator = new CommandsMigrator(sourceDir, allToolsWithCustom, testOptions, TOOL_CONFIGS as any)

        const result = await migrator.migrate()

        expect(result.success).toBeGreaterThan(0)
        expect(result.error).toBe(0)

        /** 验证转换结果 */
        // Cursor
        const cursorCommandPath = join(testTargetDir, '.cursor', 'commands', 'test-command.md')
        expect(await fileExists(cursorCommandPath)).toBe(true)

        // Claude
        const claudeCommandPath = join(testTargetDir, '.claude', 'commands', 'test-command.md')
        expect(await fileExists(claudeCommandPath)).toBe(true)

        // OpenCode
        const opencodeCommandPath = join(testTargetDir, '.config', 'opencode', 'command', 'test-command.md')
        expect(await fileExists(opencodeCommandPath)).toBe(true)

        // Gemini CLI (应该是 TOML 格式)
        const geminiCommandPath = join(testTargetDir, '.gemini', 'commands', 'test-command.toml')
        expect(await fileExists(geminiCommandPath)).toBe(true)

        // IFlow CLI (应该是 TOML 格式)
        const iflowCommandPath = join(testTargetDir, '.iflow', 'commands', 'test-command.toml')
        expect(await fileExists(iflowCommandPath)).toBe(true)

        // Codex (应该是 Markdown 格式，且目录是 prompts)
        const codexCommandPath = join(testTargetDir, '.codex', 'prompts', 'test-command.md')
        expect(await fileExists(codexCommandPath)).toBe(true)

        // Test CLI (自定义工具，应该是 Markdown 格式)
        const testCliCommandPath = join(testTargetDir, '.test-cli', 'commands', 'test-command.md')
        expect(await fileExists(testCliCommandPath)).toBe(true)

        /** 验证 TOML 转换结果 */
        const geminiContent = await readFile(geminiCommandPath, 'utf-8')
        expect(geminiContent).toContain('{{args}}')
        expect(geminiContent).toContain('{{arg1}}')
        expect(geminiContent).toContain('echo "Hello, {{arg1}}!"')

        /** 验证 Codex 转换结果 */
        const codexContent = await readFile(codexCommandPath, 'utf-8')
        expect(codexContent).toContain('# 测试命令')
        expect(codexContent).toContain('这是一个测试命令')
      })
    })

    describe('skills 转换', () => {
      it('应该成功将 Claude Skills 转换到所有工具（包括自定义工具）', async () => {
        const sourceDir = join(testTargetDir, '.claude', 'skills')
        const migrator = new SkillsMigrator(sourceDir, allToolsWithCustom, testOptions, TOOL_CONFIGS as any)

        const result = await migrator.migrate()

        expect(result.success).toBeGreaterThan(0)
        expect(result.error).toBe(0)

        /** 验证转换结果 */
        for (const tool of allToolsWithCustom) {
          let skillDir: string
          if (tool === 'opencode') {
            skillDir = join(testTargetDir, '.config', 'opencode', 'skill')
          }
          else if (tool === 'codex') {
            skillDir = join(testTargetDir, '.codex', 'skills')
          }
          else {
            skillDir = join(testTargetDir, `.${tool}`, 'skills')
          }
          const skillPath = join(skillDir, 'test-skill.md')
          expect(await fileExists(skillPath)).toBe(true)
        }
      })
    })

    describe('rules 转换', () => {
      it('应该成功将 Claude Rules 转换到所有工具（包括自定义工具）', async () => {
        const sourceDir = join(testTargetDir, '.cursor', 'rules')
        const migrator = new RulesMigrator(sourceDir, allToolsWithCustom, testOptions, TOOL_CONFIGS as any)

        const result = await migrator.migrate()

        expect(result.success).toBeGreaterThan(0)
        expect(result.error).toBe(0)

        /** 验证转换结果 */
        for (const tool of allToolsWithCustom) {
          const toolConfig = TOOL_CONFIGS[tool]
          const rulesConfig = toolConfig.rules

          if (rulesConfig.merge) {
            /** 对于需要合并的工具，应该是单个文件 */
            const rulesFileName = (rulesConfig.target || '').split('/').pop() || ''
            const rulesPath = tool === 'opencode'
              ? join(testTargetDir, '.config', 'opencode', rulesFileName)
              : join(testTargetDir, `.${tool}`, rulesFileName)
            expect(await fileExists(rulesPath)).toBe(true)

            /** 验证 Codex 规则文件内容 */
            if (tool === 'codex') {
              const content = await readFile(rulesPath, 'utf-8')
              expect(content).toContain('测试规则 1')
              expect(content).toContain('测试规则 2')
            }
          }
          else {
            /** 对于不需要合并的工具，应该是目录 */
            const rulesPath = tool === 'opencode'
              ? join(testTargetDir, '.config', 'opencode', 'rules')
              : join(testTargetDir, `.${tool}`, 'rules')
            expect(await fileExists(rulesPath)).toBe(true)
            expect(await fileExists(join(rulesPath, 'test-rule-1.mdc'))).toBe(true)
            expect(await fileExists(join(rulesPath, 'test-rule-2.mdc'))).toBe(true)
          }
        }
      })
    })

    describe('mCP 转换', () => {
      it('应该成功将 Claude MCP 配置转换到所有工具（包括自定义工具）', async () => {
        const sourceFile = join(testTargetDir, '.claude.json')
        const migrator = new MCPMigrator(sourceFile, allToolsWithCustom, testOptions, TOOL_CONFIGS as any)

        const result = await migrator.migrate()

        expect(result.success).toBeGreaterThan(0)
        expect(result.error).toBe(0)

        /** 验证转换结果 */
        for (const tool of allToolsWithCustom) {
          let mcpPath: string

          switch (tool) {
            case 'cursor':
              mcpPath = join(testTargetDir, '.cursor', 'mcp.json')
              break
            case 'claude':
              mcpPath = join(testTargetDir, '.claude', '.claude.json')
              break
            case 'opencode':
              mcpPath = join(testTargetDir, '.config', 'opencode', 'opencode.jsonc')
              break
            case 'gemini':
            case 'iflow':
              mcpPath = join(testTargetDir, `.${tool}`, 'settings.json')
              break
            case 'codex':
              mcpPath = join(testTargetDir, '.codex', 'config.toml')
              break
            case 'test-cli':
              mcpPath = join(testTargetDir, '.test-cli', 'mcp.json')
              break
            default:
              mcpPath = join(testTargetDir, `.${tool}`, 'mcp.json')
          }

          expect(await fileExists(mcpPath)).toBe(true)
        }
      })
    })
  })

  describe('cursor Rules → 其他工具转换', () => {
    it('应该成功将 Cursor Rules 转换到所有工具（包括自定义工具）', async () => {
      const sourceDir = join(testTargetDir, '.cursor', 'rules')
      const migrator = new RulesMigrator(sourceDir, allToolsWithCustom, testOptions, TOOL_CONFIGS as any)

      const result = await migrator.migrate()

      expect(result.success).toBeGreaterThan(0)
      expect(result.error).toBe(0)

      /** 验证转换结果 */
      for (const tool of allToolsWithCustom) {
        const toolConfig = TOOL_CONFIGS[tool]
        const rulesConfig = toolConfig.rules

        if (rulesConfig.merge) {
          /** 对于需要合并的工具，应该是单个文件 */
          const rulesFileName = (rulesConfig.target || '').split('/').pop() || ''
          const rulesPath = tool === 'opencode'
            ? join(testTargetDir, '.config', 'opencode', rulesFileName)
            : join(testTargetDir, `.${tool}`, rulesFileName)

          /** 验证文件存在 */
          expect(await fileExists(rulesPath)).toBe(true)

          /** 验证文件内容 */
          const content = await readFile(rulesPath, 'utf-8')
          expect(content).toContain('测试规则 1')
          expect(content).toContain('测试规则 2')
          expect(content).not.toContain('---description:') // 确保没有元数据
        }
        else {
          /** 对于不需要合并的工具，应该是目录 */
          const rulesPath = tool === 'opencode'
            ? join(testTargetDir, '.config', 'opencode', 'rules')
            : join(testTargetDir, `.${tool}`, 'rules')
          expect(await fileExists(rulesPath)).toBe(true)
          expect(await fileExists(join(rulesPath, 'test-rule-1.mdc'))).toBe(true)
          expect(await fileExists(join(rulesPath, 'test-rule-2.mdc'))).toBe(true)
        }
      }
    })
  })

  describe('claude Rules → Cursor Rules 转换', () => {
    it('应该成功将 Claude Rules 转换为 Cursor Rules (MDC 格式)', async () => {
      const claudeMdPath = join(testSourceDir, '.claude', 'CLAUDE.md')
      expect(await fileExists(claudeMdPath)).toBe(true)

      const content = await readFile(claudeMdPath, 'utf-8')
      expect(content).toContain('代码要求')
      expect(content).toContain('组件化')
      expect(content).toContain('babel-plugin-react-compiler')
    })
  })
})
