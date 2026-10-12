/**
 * 软链接替换事务的失败时序验证
 *
 * 通过可编程的 symlink/rename 脚本模拟各阶段失败：
 * - 链接创建失败（如 Windows 无符号链接权限）
 * - 旧内容改名备份失败 / 新链接就位失败 / 恢复失败
 *
 * 不变量：任何阶段失败都不丢失旧的复制内容，临时文件不残留
 */

import type { ToolKey } from '@lib/config'
import type { MigrationStats } from '@lib/migrators/types'
import { lstat, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { TOOL_CONFIGS } from '@lib/config'
import { SkillsMigrator } from '@lib/migrators/skills'
import { ensureDirectoryExists, removeDirectory, writeFile } from '@lib/utils/file'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** 独立于 test-output 的输出目录，避免与其他集成测试并行时互相清理 */
const testTargetDir = join(process.cwd(), 'test-output-failure')
/** 单条目源目录：保证 rename 脚本按固定顺序消费，不受 readdir 顺序影响 */
const singleSourceSkills = join(testTargetDir, '.claude-single', 'skills')

/**
 * 可编程失败脚本：每次调用消费一项
 * - 'ok' / 缺省：透传真实实现
 * - Error：以该错误 reject
 */
const failureScripts = vi.hoisted(() => ({
  symlink: [] as Array<'ok' | Error>,
  rename: [] as Array<'ok' | Error>,
}))

/** Mock os module to redirect home directory to test-output-failure */
vi.mock('node:os', async () => {
  const actual = await vi.importActual('node:os') as any
  return {
    ...actual,
    homedir: () => testTargetDir,
  }
})

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return {
    ...actual,
    symlink: (...args: Parameters<typeof actual.symlink>) => {
      const script = failureScripts.symlink.shift()
      return script instanceof Error
        ? Promise.reject(script)
        : actual.symlink(...args)
    },
    rename: (...args: Parameters<typeof actual.rename>) => {
      const script = failureScripts.rename.shift()
      return script instanceof Error
        ? Promise.reject(script)
        : actual.rename(...args)
    },
  }
})

function EPERM() {
  return Object.assign(
    new Error('EPERM: operation not permitted, symlink'),
    { code: 'EPERM' },
  )
}

async function migrate(): Promise<MigrationStats> {
  const migrator = new SkillsMigrator(
    singleSourceSkills,
    ['cursor'] as ToolKey[],
    { autoOverwrite: true },
    TOOL_CONFIGS,
  )
  return migrator.migrate()
}

/** 预置旧的复制产物（真实文件与目录） */
async function prepareOldCopies(): Promise<{ targetSkills: string }> {
  const targetSkills = join(testTargetDir, '.cursor', 'skills')
  await ensureDirectoryExists(targetSkills)
  await writeFile(join(targetSkills, 'test-skill.md'), 'old copy')
  await ensureDirectoryExists(join(targetSkills, 'demo-skill'))
  await writeFile(join(targetSkills, 'demo-skill', 'SKILL.md'), 'old copy')
  return { targetSkills }
}

describe('软链接替换事务失败保护', () => {
  beforeEach(async () => {
    failureScripts.symlink.length = 0
    failureScripts.rename.length = 0

    await removeDirectory(testTargetDir)
    await ensureDirectoryExists(testTargetDir)
    await ensureDirectoryExists(singleSourceSkills)
    await writeFile(join(singleSourceSkills, 'test-skill.md'), 'single source skill')
  })

  it('链接创建失败时应保留旧的复制内容并报告错误，而非先删后失败', async () => {
    const { targetSkills } = await prepareOldCopies()
    failureScripts.symlink.push(EPERM())

    const result = await migrate()

    expect(result.error).toBeGreaterThan(0)
    expect(result.errors[0]?.error).toContain('EPERM')

    expect((await lstat(join(targetSkills, 'test-skill.md'))).isSymbolicLink()).toBe(false)
    expect(await readFile(join(targetSkills, 'test-skill.md'), 'utf-8')).toBe('old copy')
    expect((await lstat(join(targetSkills, 'demo-skill'))).isSymbolicLink()).toBe(false)
    expect(await readFile(join(targetSkills, 'demo-skill', 'SKILL.md'), 'utf-8')).toBe('old copy')
    /** 源不受影响 */
    expect(await readFile(join(singleSourceSkills, 'test-skill.md'), 'utf-8')).toBe('single source skill')
  })

  it('旧内容改名备份失败时，旧内容留在原位且无临时残留', async () => {
    const { targetSkills } = await prepareOldCopies()
    /** 第一个 rename（test-skill.md → 备份）失败；后续条目正常 */
    failureScripts.rename.push(new Error('EXDEV: cross-device link'))

    const result = await migrate()

    expect(result.error).toBeGreaterThan(0)
    /** 旧内容从未离开原位 */
    expect((await lstat(join(targetSkills, 'test-skill.md'))).isSymbolicLink()).toBe(false)
    expect(await readFile(join(targetSkills, 'test-skill.md'), 'utf-8')).toBe('old copy')
    /** 无临时/备份残留 */
    const leftovers = (await readdir(targetSkills)).filter(name => name.includes('ai-sync-tmp') || name.includes('ai-sync-bak'))
    expect(leftovers).toEqual([])
  })

  it('新链接就位失败时应回滚，旧内容恢复原位', async () => {
    const { targetSkills } = await prepareOldCopies()
    /** 第一次 rename（旧内容 → 备份）成功，第二次（临时链接 → 目标）失败，第三次（恢复）正常执行 */
    failureScripts.rename.push('ok', new Error('EIO: i/o error'))

    const result = await migrate()

    expect(result.error).toBeGreaterThan(0)
    expect((await lstat(join(targetSkills, 'test-skill.md'))).isSymbolicLink()).toBe(false)
    expect(await readFile(join(targetSkills, 'test-skill.md'), 'utf-8')).toBe('old copy')
    const leftovers = (await readdir(targetSkills)).filter(name => name.includes('ai-sync-tmp') || name.includes('ai-sync-bak'))
    expect(leftovers).toEqual([])
  })

  it('恢复也失败时保留备份，并在错误信息中说明位置', async () => {
    const { targetSkills } = await prepareOldCopies()
    /** 备份成功、就位失败、恢复也失败 */
    failureScripts.rename.push('ok', new Error('EIO: i/o error'), new Error('EIO: i/o error'))

    const result = await migrate()

    expect(result.error).toBeGreaterThan(0)
    expect(result.errors[0]?.error).toContain('ai-sync-bak')

    /** 目标位置无内容，旧内容保留在备份文件中 */
    await expect(lstat(join(targetSkills, 'test-skill.md'))).rejects.toMatchObject({ code: 'ENOENT' })
    const backups = (await readdir(targetSkills)).filter(name => name.startsWith('test-skill.md.ai-sync-bak'))
    expect(backups.length).toBe(1)
    expect(await readFile(join(targetSkills, backups[0]), 'utf-8')).toBe('old copy')
  })
})
