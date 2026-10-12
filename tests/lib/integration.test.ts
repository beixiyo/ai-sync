import type { ToolKey } from '@lib/config'
import { lstat, readFile, readlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { TOOL_CONFIGS } from '@lib/config'
import { CommandsMigrator } from '@lib/migrators/commands'
import { MCPMigrator } from '@lib/migrators/mcp'
import { SettingsMigrator } from '@lib/migrators/settings'
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
const allTools: ToolKey[] = ['cursor', 'claude', 'codebuddy', 'opencode', 'gemini', 'iflow', 'codex', 'zcode']

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
  mcp: {
    source: '.claude.json',
    target: '~/.test-cli/mcp.json',
  },
  supported: ['commands', 'skills', 'mcp'],
}

/** 所有测试工具（包括自定义工具） */
const allToolsWithCustom = [...allTools, 'test-cli' as ToolKey]
;(TOOL_CONFIGS as any)['test-cli'] = testCustomConfig

/** 复制模式工具（symlink: false），验证田版复制行为仍可显式开启 */
const copySkillConfig = {
  name: 'Copy CLI',
  skills: {
    source: '.claude/skills',
    target: '~/.copy-cli/skills',
    symlink: false,
  },
  supported: ['skills'],
}
;(TOOL_CONFIGS as any)['copy-cli'] = copySkillConfig

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
      expect(await fileExists(join(testTargetDir, '.zcode', 'commands', 'test-command.md'))).toBe(true)
    })

    it('应该成功同步 Skills 到所有工具（默认软链接模式）', async () => {
      const sourceSkillsDir = join(testTargetDir, '.claude', 'skills')
      const migrator = new SkillsMigrator(sourceSkillsDir, allToolsWithCustom, { autoOverwrite: true }, TOOL_CONFIGS)
      await migrator.migrate()

      for (const tool of allToolsWithCustom) {
        let skillsDir: string
        if (tool === 'opencode')
          skillsDir = join(testTargetDir, '.config', 'opencode', 'skills')
        else if (tool === 'test-cli')
          skillsDir = join(testTargetDir, '.test-cli', 'skills')
        else skillsDir = join(testTargetDir, `.${tool}`, 'skills')

        /** 源与目标相同（claude 自身）：跳过，源保持真实文件 */
        if (tool === 'claude') {
          expect((await lstat(join(skillsDir, 'test-skill.md'))).isSymbolicLink()).toBe(false)
          continue
        }

        /** 其余工具：文件与目录 skill 都是软链接且指向源 */
        for (const entry of ['test-skill.md', 'demo-skill']) {
          const entryPath = join(skillsDir, entry)
          const stat = await lstat(entryPath)
          expect(stat.isSymbolicLink(), `${tool}/${entry} 应为软链接`).toBe(true)
          expect(resolve(skillsDir, await readlink(entryPath))).toBe(resolve(sourceSkillsDir, entry))
        }
      }
    })
  })

  describe('sKill 软链接模式', () => {
    const sourceSkillsDir = join(testTargetDir, '.claude', 'skills')
    const targetSkillsDir = join(testTargetDir, '.cursor', 'skills')

    it('应该把已复制的真实文件/目录替换为软链接', async () => {
      /** 预置旧的复制产物（真实文件与目录，模拟升级前同步过的场景） */
      await ensureDirectoryExists(join(targetSkillsDir, 'demo-skill'))
      const { writeFile } = await import('node:fs/promises')
      await writeFile(join(targetSkillsDir, 'test-skill.md'), 'old copy')
      await writeFile(join(targetSkillsDir, 'demo-skill', 'SKILL.md'), 'old copy')

      const migrator = new SkillsMigrator(sourceSkillsDir, ['cursor'], { autoOverwrite: false }, TOOL_CONFIGS)
      const result = await migrator.migrate()

      expect(result.error).toBe(0)
      expect((await lstat(join(targetSkillsDir, 'test-skill.md'))).isSymbolicLink()).toBe(true)
      expect((await lstat(join(targetSkillsDir, 'demo-skill'))).isSymbolicLink()).toBe(true)
      /** 链接内容跟随源，旧复制内容被替换 */
      expect(await readFile(join(targetSkillsDir, 'test-skill.md'), 'utf-8')).toContain('测试技能')
    })

    it('幂等：已是正确链接时跳过，重复运行不重复计数', async () => {
      const migrator = new SkillsMigrator(sourceSkillsDir, ['cursor'], { autoOverwrite: true }, TOOL_CONFIGS)
      const first = await migrator.migrate()
      const second = await migrator.migrate()

      expect(first.success).toBe(2)
      expect(second.success).toBe(0)
      expect(second.skipped).toBe(2)
      expect(second.error).toBe(0)
    })

    it('应该清理指向已删除源的失效链接（含 .. 前缀条目），保留与源无关的条目', async () => {
      /** 先完成一次同步，得到有效链接 */
      await new SkillsMigrator(sourceSkillsDir, ['cursor'], { autoOverwrite: true }, TOOL_CONFIGS).migrate()

      const { symlink, writeFile } = await import('node:fs/promises')
      /** 模拟源中被删除的 skill 遗留的失效链接，以及目标工具自己的内容 */
      await symlink(join(sourceSkillsDir, 'removed-skill'), join(targetSkillsDir, 'removed-skill'), 'junction')
      /** `..demo` 是合法的源条目名，不应因 `..` 前缀被边界判断误排除 */
      await symlink(join(sourceSkillsDir, '..demo'), join(targetSkillsDir, '..demo'), 'junction')
      await writeFile(join(targetSkillsDir, 'native-skill.md'), 'tool native content')

      /** 清理前链接自身存在（fileExists 对断链恒为 false，不能作为清理证据） */
      expect((await lstat(join(targetSkillsDir, 'removed-skill'))).isSymbolicLink()).toBe(true)

      /** 重新同步（源不变） */
      const result = await new SkillsMigrator(sourceSkillsDir, ['cursor'], { autoOverwrite: true }, TOOL_CONFIGS).migrate()
      expect(result.error).toBe(0)

      await expect(lstat(join(targetSkillsDir, 'removed-skill'))).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(lstat(join(targetSkillsDir, '..demo'))).rejects.toMatchObject({ code: 'ENOENT' })
      expect(await fileExists(join(targetSkillsDir, 'native-skill.md'))).toBe(true)
      expect(await readFile(join(targetSkillsDir, 'native-skill.md'), 'utf-8')).toBe('tool native content')
      /** 有效链接保持不变 */
      expect((await lstat(join(targetSkillsDir, 'demo-skill'))).isSymbolicLink()).toBe(true)
    })

    it('源目录被整体删除后，仍应清理目标中的遗留链接', async () => {
      await new SkillsMigrator(sourceSkillsDir, ['cursor'], { autoOverwrite: true }, TOOL_CONFIGS).migrate()

      const { rm } = await import('node:fs/promises')
      await rm(sourceSkillsDir, { recursive: true, force: true })

      const result = await new SkillsMigrator(sourceSkillsDir, ['cursor'], { autoOverwrite: true }, TOOL_CONFIGS).migrate()
      expect(result.error).toBe(0)

      await expect(lstat(join(targetSkillsDir, 'test-skill.md'))).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(lstat(join(targetSkillsDir, 'demo-skill'))).rejects.toMatchObject({ code: 'ENOENT' })
    })

    it('目标 skills 目录本身就是指向源的软链接（别名）时，应跳过并保留源', async () => {
      const cursorDir = join(testTargetDir, '.cursor')
      await ensureDirectoryExists(cursorDir)
      const { symlink } = await import('node:fs/promises')
      await symlink(sourceSkillsDir, join(cursorDir, 'skills'), 'junction')

      const result = await new SkillsMigrator(sourceSkillsDir, ['cursor'], { autoOverwrite: true }, TOOL_CONFIGS).migrate()

      expect(result.error).toBe(0)
      /** 源条目未被删除或替换，仍为真实文件 */
      expect((await lstat(join(sourceSkillsDir, 'test-skill.md'))).isSymbolicLink()).toBe(false)
      expect((await lstat(join(sourceSkillsDir, 'demo-skill'))).isSymbolicLink()).toBe(false)
      expect(await fileExists(join(sourceSkillsDir, 'demo-skill', 'SKILL.md'))).toBe(true)
      /** 别名链接本身未被改动 */
      expect((await lstat(join(cursorDir, 'skills'))).isSymbolicLink()).toBe(true)
    })

    it('从软链接模式切回复制模式：解除遗留链接，产出真实副本且源不变', async () => {
      const copyCliSkills = (TOOL_CONFIGS as any)['copy-cli'].skills as { symlink?: boolean }
      const targetDir = join(testTargetDir, '.copy-cli', 'skills')

      /** 阶段一：软链接模式同步 */
      copyCliSkills.symlink = true
      await new SkillsMigrator(sourceSkillsDir, ['copy-cli'], { autoOverwrite: true }, TOOL_CONFIGS).migrate()
      expect((await lstat(join(targetDir, 'test-skill.md'))).isSymbolicLink()).toBe(true)

      /** 阶段二：切回复制模式，遗留链接应被解除并产出真实副本 */
      copyCliSkills.symlink = false
      const result = await new SkillsMigrator(sourceSkillsDir, ['copy-cli'], { autoOverwrite: true }, TOOL_CONFIGS).migrate()
      expect(result.error).toBe(0)
      expect((await lstat(join(targetDir, 'test-skill.md'))).isSymbolicLink()).toBe(false)
      expect((await lstat(join(targetDir, 'demo-skill'))).isSymbolicLink()).toBe(false)
      expect(await readFile(join(targetDir, 'test-skill.md'), 'utf-8')).toContain('测试技能')
      expect(await fileExists(join(targetDir, 'demo-skill', 'SKILL.md'))).toBe(true)
      /** 源未被沿链接写穿 */
      expect((await lstat(join(sourceSkillsDir, 'test-skill.md'))).isSymbolicLink()).toBe(false)
    })

    it('从软链接模式切到 transform 模式：写入真实文件而非沿链接改源', async () => {
      const transformSkills: any = {
        source: '.claude/skills',
        target: '~/.transform-cli/skills',
        symlink: true,
      }
      ;(TOOL_CONFIGS as any)['transform-cli'] = {
        name: 'Transform CLI',
        skills: transformSkills,
        supported: ['skills'],
      }
      const targetDir = join(testTargetDir, '.transform-cli', 'skills')

      /** 阶段一：软链接模式同步 */
      await new SkillsMigrator(sourceSkillsDir, ['transform-cli'], { autoOverwrite: true }, TOOL_CONFIGS).migrate()
      expect((await lstat(join(targetDir, 'test-skill.md'))).isSymbolicLink()).toBe(true)

      /** 阶段二：配置 transform 后重新同步 */
      transformSkills.transform = (content: string) => `${content}\nTRANSFORMED`
      const result = await new SkillsMigrator(sourceSkillsDir, ['transform-cli'], { autoOverwrite: true }, TOOL_CONFIGS).migrate()
      expect(result.error).toBe(0)
      expect(result.success).toBeGreaterThan(0)

      /** 目标产出真实文件且带转换内容，源未被写穿 */
      expect((await lstat(join(targetDir, 'test-skill.md'))).isSymbolicLink()).toBe(false)
      expect(await readFile(join(targetDir, 'test-skill.md'), 'utf-8')).toContain('TRANSFORMED')
      expect(await readFile(join(sourceSkillsDir, 'test-skill.md'), 'utf-8')).not.toContain('TRANSFORMED')
    })

    it('同名的原生 .ai-sync-bak/.ai-sync-tmp 条目不被误删', async () => {
      const { writeFile } = await import('node:fs/promises')
      await ensureDirectoryExists(join(targetSkillsDir, 'demo-skill.ai-sync-bak'))
      await writeFile(join(targetSkillsDir, 'test-skill.md.ai-sync-tmp'), 'native tmp entry')

      await new SkillsMigrator(sourceSkillsDir, ['cursor'], { autoOverwrite: true }, TOOL_CONFIGS).migrate()

      expect(await fileExists(join(targetSkillsDir, 'demo-skill.ai-sync-bak'))).toBe(true)
      expect(await readFile(join(targetSkillsDir, 'test-skill.md.ai-sync-tmp'), 'utf-8')).toBe('native tmp entry')
    })

    it('目标配置在源目录内部时，应整体跳过，不在源内创建内容', async () => {
      ;(TOOL_CONFIGS as any)['inside-cli'] = {
        name: 'Inside CLI',
        skills: { source: '.claude/skills', target: '~/.claude/skills/inside-dest' },
        supported: ['skills'],
      }

      const result = await new SkillsMigrator(sourceSkillsDir, ['inside-cli' as ToolKey], { autoOverwrite: true }, TOOL_CONFIGS).migrate()

      expect(result.error).toBe(0)
      expect(await fileExists(join(sourceSkillsDir, 'inside-dest'))).toBe(false)
    })

    it('换源后 transform 不沿旧链接写穿旧源', async () => {
      const sourceB = join(testTargetDir, '.source-b', 'skills')
      await ensureDirectoryExists(sourceB)
      const { writeFile } = await import('node:fs/promises')
      await writeFile(join(sourceB, 'test-skill.md'), '# from source B')

      const switchSkills: any = { source: '.claude/skills', target: '~/.switch-cli/skills' }
      ;(TOOL_CONFIGS as any)['switch-cli'] = {
        name: 'Switch CLI',
        skills: switchSkills,
        supported: ['skills'],
      }
      const targetDir = join(testTargetDir, '.switch-cli', 'skills')

      /** 阶段一：从源 A 软链接同步，目标链接指向 A */
      await new SkillsMigrator(sourceSkillsDir, ['switch-cli' as ToolKey], { autoOverwrite: true }, TOOL_CONFIGS).migrate()
      expect((await lstat(join(targetDir, 'test-skill.md'))).isSymbolicLink()).toBe(true)

      /** 阶段二：换源 B + transform，旧链接指向 A，不应写穿 */
      switchSkills.transform = (content: string) => `${content}\nTRANSFORMED`
      const result = await new SkillsMigrator(sourceB, ['switch-cli' as ToolKey], { autoOverwrite: true }, TOOL_CONFIGS).migrate()
      expect(result.error).toBe(0)

      /** 旧源 A 完好，未被写穿 */
      expect(await readFile(join(sourceSkillsDir, 'test-skill.md'), 'utf-8')).not.toContain('TRANSFORMED')
      /** 目标是真实文件，内容来自源 B */
      expect((await lstat(join(targetDir, 'test-skill.md'))).isSymbolicLink()).toBe(false)
      expect(await readFile(join(targetDir, 'test-skill.md'), 'utf-8')).toContain('from source B')
    })

    it('源路径以别名传入时，遗留链接仍被解除（realpath 比较）', async () => {
      const aliasDir = join(testTargetDir, '.source-alias')
      await ensureDirectoryExists(aliasDir)
      const { symlink } = await import('node:fs/promises')
      await symlink(sourceSkillsDir, join(aliasDir, 'skills'), 'junction')

      const copyCliSkills = (TOOL_CONFIGS as any)['copy-cli'].skills as { symlink?: boolean }
      const targetDir = join(testTargetDir, '.copy-cli', 'skills')

      /** 阶段一：真实路径软链接同步 */
      copyCliSkills.symlink = true
      await new SkillsMigrator(sourceSkillsDir, ['copy-cli'], { autoOverwrite: true }, TOOL_CONFIGS).migrate()
      expect((await lstat(join(targetDir, 'test-skill.md'))).isSymbolicLink()).toBe(true)

      /** 阶段二：以别名路径 + 复制模式同步，遗留链接应被解除 */
      copyCliSkills.symlink = false
      const result = await new SkillsMigrator(join(aliasDir, 'skills'), ['copy-cli'], { autoOverwrite: true }, TOOL_CONFIGS).migrate()
      expect(result.error).toBe(0)
      expect((await lstat(join(targetDir, 'test-skill.md'))).isSymbolicLink()).toBe(false)
      expect(await readFile(join(targetDir, 'test-skill.md'), 'utf-8')).toContain('测试技能')
    })

    it('交叉布局（skills CLI：源条目链接到目标目录内的真实文件）时不删除真实数据', async () => {
      /** 复刻事故布局：真实数据在 ~/.agents/skills，源 ~/.claude/skills 里是指向它的相对链接 */
      const agentsSkills = join(testTargetDir, '.agents', 'skills')
      await ensureDirectoryExists(join(agentsSkills, 'lark-demo'))
      const { writeFile, symlink } = await import('node:fs/promises')
      await writeFile(join(agentsSkills, 'lark-demo', 'SKILL.md'), 'real lark skill data')
      await symlink('../../.agents/skills/lark-demo', join(sourceSkillsDir, 'lark-demo'), 'junction')

      /** pi 的目标恰好是 ~/.agents/skills */
      const result = await new SkillsMigrator(sourceSkillsDir, ['pi' as ToolKey], { autoOverwrite: true }, TOOL_CONFIGS).migrate()

      expect(result.error).toBe(0)
      expect(result.skipped).toBeGreaterThanOrEqual(1)

      /** 真实数据完好，未被替换为链接，也未形成循环 */
      expect((await lstat(join(agentsSkills, 'lark-demo'))).isSymbolicLink()).toBe(false)
      expect(await readFile(join(agentsSkills, 'lark-demo', 'SKILL.md'), 'utf-8')).toBe('real lark skill data')
      /** 源里的链接未被改动，且经它仍能读到真实数据 */
      expect((await lstat(join(sourceSkillsDir, 'lark-demo'))).isSymbolicLink()).toBe(true)
      expect(await readFile(join(sourceSkillsDir, 'lark-demo', 'SKILL.md'), 'utf-8')).toBe('real lark skill data')
      /** 普通条目正常链接 */
      expect((await lstat(join(agentsSkills, 'test-skill.md'))).isSymbolicLink()).toBe(true)
    })

    it('换源后切复制模式：旧目录链接不写穿旧源，产出真实目录', async () => {
      const sourceA = join(testTargetDir, '.claude', 'skills')
      const sourceB = join(testTargetDir, '.source-c', 'skills')
      await ensureDirectoryExists(join(sourceB, 'demo-skill'))
      const { writeFile } = await import('node:fs/promises')
      await writeFile(join(sourceB, 'demo-skill', 'SKILL.md'), '# from source C')

      const cursorSkills = (TOOL_CONFIGS as any).cursor.skills
      const targetDir = join(testTargetDir, '.cursor', 'skills')

      /** 阶段一：从源 A 软链接同步，目标目录链接指向 A */
      await new SkillsMigrator(sourceA, ['cursor'], { autoOverwrite: true }, TOOL_CONFIGS).migrate()
      expect((await lstat(join(targetDir, 'demo-skill'))).isSymbolicLink()).toBe(true)

      /** 阶段二：换源 C + 复制模式 + 覆盖，旧链接指向 A，不应把 C 的内容写进 A */
      cursorSkills.symlink = false
      try {
        const result = await new SkillsMigrator(sourceB, ['cursor'], { autoOverwrite: true }, TOOL_CONFIGS).migrate()
        expect(result.error).toBe(0)
      }
      finally {
        cursorSkills.symlink = undefined
      }

      /** 旧源 A 的内容未被覆盖 */
      expect(await readFile(join(sourceA, 'demo-skill', 'SKILL.md'), 'utf-8')).not.toContain('from source C')
      /** 目标产出真实目录，内容来自新源 C */
      expect((await lstat(join(targetDir, 'demo-skill'))).isSymbolicLink()).toBe(false)
      expect(await readFile(join(targetDir, 'demo-skill', 'SKILL.md'), 'utf-8')).toContain('from source C')
    })

    it('断链目标在 autoOverwrite: false 下不写穿：解除断链后写入真实文件', async () => {
      const sourceA = join(testTargetDir, '.source-d', 'skills')
      await ensureDirectoryExists(sourceA)
      const sourceE = join(testTargetDir, '.claude', 'skills')
      const targetDir = join(testTargetDir, '.copy-cli', 'skills')
      const { symlink } = await import('node:fs/promises')

      await ensureDirectoryExists(targetDir)
      /** 断链：指向旧源 A 中已不存在的文件 */
      await symlink(join(sourceA, 'gone.md'), join(targetDir, 'gone.md'), 'file')

      /** 源 E 有同名文件，复制模式且不覆盖：断链在 fileExists 下视为不存在，会写入 */
      const { writeFile } = await import('node:fs/promises')
      await writeFile(join(sourceE, 'gone.md'), '# reborn in source')
      const result = await new SkillsMigrator(sourceE, ['copy-cli'], { autoOverwrite: false }, TOOL_CONFIGS).migrate()

      expect(result.error).toBe(0)
      /** 旧源 A 中未重建文件（未写穿） */
      expect(await fileExists(join(sourceA, 'gone.md'))).toBe(false)
      /** 目标是真实文件而非链接 */
      expect((await lstat(join(targetDir, 'gone.md'))).isSymbolicLink()).toBe(false)
      expect(await readFile(join(targetDir, 'gone.md'), 'utf-8')).toContain('reborn in source')
    })

    it('交叉布局切回复制模式：目标链接保留，skill 不静默消失', async () => {
      /** 复刻 skills CLI 交叉布局 */
      const agentsSkills = join(testTargetDir, '.agents', 'skills')
      await ensureDirectoryExists(join(agentsSkills, 'lark-demo'))
      const { writeFile, symlink } = await import('node:fs/promises')
      await writeFile(join(agentsSkills, 'lark-demo', 'SKILL.md'), 'real lark skill data')
      await symlink('../../.agents/skills/lark-demo', join(sourceSkillsDir, 'lark-demo'), 'junction')

      const cursorSkills = (TOOL_CONFIGS as any).cursor.skills
      const targetDir = join(testTargetDir, '.cursor', 'skills')

      /** 阶段一：默认软链接同步到 cursor */
      await new SkillsMigrator(sourceSkillsDir, ['cursor'], { autoOverwrite: true }, TOOL_CONFIGS).migrate()
      expect((await lstat(join(targetDir, 'lark-demo'))).isSymbolicLink()).toBe(true)

      /** 阶段二：切复制模式：源条目是链接，目标链接应保留（复制无法产出该条目） */
      cursorSkills.symlink = false
      try {
        const result = await new SkillsMigrator(sourceSkillsDir, ['cursor'], { autoOverwrite: true }, TOOL_CONFIGS).migrate()
        expect(result.error).toBe(0)
      }
      finally {
        cursorSkills.symlink = undefined
      }

      /** 链接仍在且可读，skill 未消失 */
      expect((await lstat(join(targetDir, 'lark-demo'))).isSymbolicLink()).toBe(true)
      expect(await readFile(join(targetDir, 'lark-demo', 'SKILL.md'), 'utf-8')).toBe('real lark skill data')
      /** 真实数据完好 */
      expect((await lstat(join(agentsSkills, 'lark-demo'))).isSymbolicLink()).toBe(false)
    })

    it('目标经父目录别名落在源内部时，不创建任何内容', async () => {
      const aliasDir = join(testTargetDir, '.source-alias-all')
      await ensureDirectoryExists(aliasDir)
      const { symlink } = await import('node:fs/promises')
      /** 别名指向源本身，目标配置在别名下的不存在子目录 */
      await symlink(sourceSkillsDir, join(aliasDir, 'skills'), 'junction')
      ;(TOOL_CONFIGS as any)['alias-cli'] = {
        name: 'Alias CLI',
        skills: { source: '.claude/skills', target: join(aliasDir, 'skills', 'generated') },
        supported: ['skills'],
      }

      const result = await new SkillsMigrator(sourceSkillsDir, ['alias-cli' as ToolKey], { autoOverwrite: true }, TOOL_CONFIGS).migrate()

      expect(result.error).toBe(0)
      /** 源内部未创建任何目录或链接 */
      expect(await fileExists(join(sourceSkillsDir, 'generated'))).toBe(false)
    })

    it('symlink: false 时回退复制模式，产出真实文件', async () => {
      const migrator = new SkillsMigrator(sourceSkillsDir, ['copy-cli'], { autoOverwrite: true }, TOOL_CONFIGS)
      await migrator.migrate()

      const copyDir = join(testTargetDir, '.copy-cli', 'skills')
      expect((await lstat(join(copyDir, 'test-skill.md'))).isSymbolicLink()).toBe(false)
      expect((await lstat(join(copyDir, 'demo-skill'))).isSymbolicLink()).toBe(false)
      expect(await fileExists(join(copyDir, 'demo-skill', 'SKILL.md'))).toBe(true)
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

    it('codex (TOML) 迁移应保留无关配置的注释，新增 server 正确写为独立 section', async () => {
      const codexConfigPath = join(testTargetDir, '.codex', 'config.toml')
      await ensureDirectoryExists(join(testTargetDir, '.codex'))
      const { writeFile } = await import('node:fs/promises')
      await writeFile(codexConfigPath, '# 用户自定义配置（勿删）\nmodel = "o3"  # 偏好模型\n', 'utf-8')

      const migrator = new MCPMigrator(join(testTargetDir, '.claude.json'), ['codex'], { autoOverwrite: true }, TOOL_CONFIGS)
      await migrator.migrate()

      const content = await readFile(codexConfigPath, 'utf-8')
      /** 无关配置的注释与值被完整保留 */
      expect(content).toContain('# 用户自定义配置（勿删）')
      expect(content).toContain('# 偏好模型')
      expect(content).toContain('model = "o3"')
      /** 迁移的 server 写为独立 section（非内联、未泄漏到根级）并带上 approve */
      expect(content).toContain('[mcp_servers.local-mcp]')
      expect(content).toContain('default_tools_approval_mode = "approve"')
    })

    it('jSONC 目标迁移应保留无关字段的注释', async () => {
      const jsoncPath = join(testTargetDir, '.config', 'opencode', 'opencode.jsonc')
      await ensureDirectoryExists(join(testTargetDir, '.config', 'opencode'))
      const { writeFile } = await import('node:fs/promises')
      await writeFile(jsoncPath, '{\n  // 重要：自定义主题，勿删\n  "theme": "dark",\n  "mcp": {}\n}', 'utf-8')

      const migrator = new MCPMigrator(join(testTargetDir, '.claude.json'), ['opencode'], { autoOverwrite: true }, TOOL_CONFIGS)
      await migrator.migrate()

      const content = await readFile(jsoncPath, 'utf-8')
      /** 无关字段的注释被保留 */
      expect(content).toContain('// 重要：自定义主题，勿删')
      expect(content).toContain('"theme": "dark"')
    })

    it('zcode 迁移应写入 mcp.servers 嵌套结构，并保留 config.json 其他根键', async () => {
      const zcodeConfigPath = join(testTargetDir, '.zcode', 'cli', 'config.json')
      await ensureDirectoryExists(join(testTargetDir, '.zcode', 'cli'))
      await writeJSONFile(zcodeConfigPath, {
        provider: {
          'builtin:zai': { enabled: true },
        },
      })

      const migrator = new MCPMigrator(join(testTargetDir, '.claude.json'), ['zcode'], { autoOverwrite: true }, TOOL_CONFIGS)
      await migrator.migrate()

      const content = JSON.parse(await readFile(zcodeConfigPath, 'utf-8'))
      /** 本地 server 字段与 Claude 一致，直接迁移 */
      expect(content.mcp.servers['local-mcp']).toEqual({
        command: 'npx',
        args: ['mcp-server', '--api-key', 'test-api-key'],
        env: {
          NODE_ENV: 'development',
        },
      })
      /** 远程 server 保留 url/type/headers */
      expect(content.mcp.servers['remote-mcp']).toEqual({
        url: 'http://localhost:3000/mcp',
        type: 'http',
        headers: {
          Authorization: 'Bearer test-token',
        },
      })
      /** 无关根键被完整保留 */
      expect(content.provider['builtin:zai'].enabled).toBe(true)
    })
  })

  describe('zCode Settings 迁移', () => {
    it('仅迁移兼容的 Hooks 事件，且不破坏同文件中的 mcp 配置', async () => {
      const zcodeConfigPath = join(testTargetDir, '.zcode', 'cli', 'config.json')
      await ensureDirectoryExists(join(testTargetDir, '.zcode', 'cli'))
      await writeJSONFile(zcodeConfigPath, {
        mcp: {
          servers: {
            'keep-me': { command: 'node' },
          },
        },
      })

      const settingsPath = join(testTargetDir, '.claude', 'settings.json')
      await writeJSONFile(settingsPath, {
        hooks: {
          PreToolUse: [
            { matcher: 'Write', hooks: [{ type: 'command', command: 'node check.mjs' }] },
          ],
          PreCompact: [
            { hooks: [{ command: 'compact.sh' }] },
          ],
        },
        permissions: {
          allow: ['Bash(*)'],
        },
      })

      const migrator = new SettingsMigrator(settingsPath, ['zcode'], { autoOverwrite: false }, TOOL_CONFIGS)
      await migrator.migrate()

      const content = JSON.parse(await readFile(zcodeConfigPath, 'utf-8'))
      /** Hooks 被包装为 events 结构并启用，type: command 被移除 */
      expect(content.hooks).toEqual({
        enabled: true,
        events: {
          PreToolUse: [
            { matcher: 'Write', hooks: [{ command: 'node check.mjs' }] },
          ],
        },
      })
      /** Claude 专属字段不迁移 */
      expect(content.permissions).toBeUndefined()
      /** 同文件中已有的 mcp 配置不受影响 */
      expect(content.mcp.servers['keep-me']).toBeDefined()
    })

    it('源配置无可迁移 Hooks 时不产生写入', async () => {
      const zcodeConfigPath = join(testTargetDir, '.zcode', 'cli', 'config.json')
      await ensureDirectoryExists(join(testTargetDir, '.zcode', 'cli'))

      const settingsPath = join(testTargetDir, '.claude', 'settings.json')
      await writeJSONFile(settingsPath, {
        hooks: {
          PreCompact: [
            { hooks: [{ command: 'compact.sh' }] },
          ],
        },
      })

      const migrator = new SettingsMigrator(settingsPath, ['zcode'], { autoOverwrite: false }, TOOL_CONFIGS)
      await migrator.migrate()

      /** 无兼容事件时不创建空配置文件 */
      expect(await fileExists(zcodeConfigPath)).toBe(false)
    })
  })

  describe('覆盖迁移与冲突处理 (autoOverwrite)', () => {
    it('当 autoOverwrite 为 false 时，不应覆盖已存在的 Commands', async () => {
      const targetPath = join(testTargetDir, '.cursor', 'commands', 'test-command.md')
      await ensureDirectoryExists(join(testTargetDir, '.cursor', 'commands'))
      const { writeFile } = await import('node:fs/promises')
      await writeFile(targetPath, 'original content')

      const migrator = new CommandsMigrator(join(testTargetDir, '.claude', 'commands'), ['cursor'], { autoOverwrite: false }, TOOL_CONFIGS)
      const result = await migrator.migrate()

      expect(result.skipped).toBeGreaterThan(0)
      const content = await readFile(targetPath, 'utf-8')
      expect(content).toBe('original content')
    })

    it('复制模式且 autoOverwrite 为 false 时，不应覆盖已存在的 Skills', async () => {
      const targetPath = join(testTargetDir, '.copy-cli', 'skills', 'test-skill.md')
      await ensureDirectoryExists(join(testTargetDir, '.copy-cli', 'skills'))
      const { writeFile } = await import('node:fs/promises')
      await writeFile(targetPath, 'original skill')

      const migrator = new SkillsMigrator(join(testTargetDir, '.claude', 'skills'), ['copy-cli'], { autoOverwrite: false }, TOOL_CONFIGS)
      const result = await migrator.migrate()

      expect(result.skipped).toBeGreaterThan(0)
      const content = await readFile(targetPath, 'utf-8')
      expect(content).toBe('original skill')
    })
  })

  describe('各工具路径与格式准确性验证', () => {
    it('openCode 应该使用正确的目录名 (command/skill) 和 opencode.jsonc 扩展名', async () => {
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
      expect(tomlContent).toContain('default_tools_approval_mode = "approve"')
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
})
