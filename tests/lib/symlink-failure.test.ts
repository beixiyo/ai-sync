/** 验证只补链接的模式遇到文件系统错误或并发占位时不会覆盖目标 */
import { ensureDirectoryExists, symlinkDirectory } from '@lib/utils/file'
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, symlink: vi.fn(actual.symlink) }
})

let root: string
let source: string
let target: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'ai-sync-skills-'))
  source = join(root, 'source')
  target = join(root, 'target')
  await ensureDirectoryExists(source)
  await writeFile(join(source, 'test-skill.md'), 'source data')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

it('无法创建链接时报告错误且不影响源', async () => {
  vi.mocked(symlink).mockRejectedValueOnce(Object.assign(new Error('EPERM'), { code: 'EPERM' }))
  const result = await symlinkDirectory(source, target)
  expect(result).toMatchObject({ success: 0, error: 1, errors: [{ error: 'EPERM' }] })
  expect(await readFile(join(source, 'test-skill.md'), 'utf-8')).toBe('source data')
})

it('检查后出现并发占位时保留新文件并报告冲突', async () => {
  vi.mocked(symlink).mockImplementationOnce(async (_, path) => {
    await writeFile(path, 'concurrent data', { flag: 'wx' })
    throw Object.assign(new Error('EEXIST'), { code: 'EEXIST' })
  })
  const onSkip = vi.fn()
  const result = await symlinkDirectory(source, target, { onSkip })
  expect(result).toMatchObject({ success: 0, skipped: 1, error: 0 })
  expect(onSkip).toHaveBeenCalledWith(join(target, 'test-skill.md'), 'conflict')
  expect(await readFile(join(target, 'test-skill.md'), 'utf-8')).toBe('concurrent data')
})
