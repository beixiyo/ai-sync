/**
 * 解除遗留软链接失败时的防护验证
 *
 * 模拟目标目录可读不可写（rm 链接报 EACCES）：
 * 复制模式必须中止该工具的迁移并报错，而不是吞掉错误后继续写入
 * （继续写入可能沿链接改写真实源文件）
 */

import type { ToolKey } from '@lib/config'
import { lstat, readFile, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { TOOL_CONFIGS } from '@lib/config'
import { SkillsMigrator } from '@lib/migrators/skills'
import { copyDirectory, ensureDirectoryExists, removeDirectory } from '@lib/utils/file'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const testSourceDir = join(process.cwd(), 'test-data')
/** 独立输出目录，避免与其他集成测试并行时互相清理 */
const testTargetDir = join(process.cwd(), 'test-output-unlink') /** 注册 symlink: false 的复制模式工具（每个测试文件模块独立，需单独注册） */
;(TOOL_CONFIGS as any)['copy-cli'] = {
  name: 'Copy CLI',
  skills: {
    source: '.claude/skills',
    target: '~/.copy-cli/skills',
    symlink: false,
  },
  supported: ['skills'],
}

/** Mock os module to redirect home directory */
vi.mock('node:os', async () => {
  const actual = await vi.importActual('node:os') as any
  return {
    ...actual,
    homedir: () => testTargetDir,
  }
})

/** 非递归 rm（解除链接用）一律 EACCES；递归 rm（目录清理用）透传 */
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    rm: ((path: string, options?: any) => {
      if (options?.recursive)
        return actual.rm(path, options)
      return Promise.reject(Object.assign(
        new Error(`EACCES: permission denied, unlink '${path}'`),
        { code: 'EACCES' },
      ))
    }) as typeof actual.rm,
  }
})

describe('解除遗留软链接失败防护', () => {
  beforeEach(async () => {
    await removeDirectory(testTargetDir)
    await ensureDirectoryExists(testTargetDir)
    await copyDirectory(join(testSourceDir, '.claude'), join(testTargetDir, '.claude'))
  })

  it('解除失败时应中止迁移并报错，不继续写入目标', async () => {
    const sourceSkills = join(testTargetDir, '.claude', 'skills')
    const targetSkills = join(testTargetDir, '.copy-cli', 'skills')

    /** 预置遗留软链接（指向源内部，模拟软链接模式的产物） */
    await ensureDirectoryExists(targetSkills)
    await symlink(join(sourceSkills, 'test-skill.md'), join(targetSkills, 'test-skill.md'), 'file')

    /** copy-cli 配置了 symlink: false，走「解除 → 复制」路径 */
    const migrator = new SkillsMigrator(
      sourceSkills,
      ['copy-cli'] as ToolKey[],
      { autoOverwrite: true },
      TOOL_CONFIGS,
    )
    const result = await migrator.migrate()

    /** 解除失败被如实报告 */
    expect(result.error).toBeGreaterThan(0)
    expect(result.errors[0]?.error).toContain('EACCES')

    /** 中止：链接原样保留，未产出复制内容 */
    expect((await lstat(join(targetSkills, 'test-skill.md'))).isSymbolicLink()).toBe(true)
    /** demo-skill 无复制产物 */
    await expect(lstat(join(targetSkills, 'demo-skill'))).rejects.toMatchObject({ code: 'ENOENT' })
    /** 源不受影响 */
    expect(await readFile(join(sourceSkills, 'test-skill.md'), 'utf-8')).toContain('测试技能')
  })
})
