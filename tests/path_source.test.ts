import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCommandsSourcePath, getSkillsSourcePath } from '../src/lib/path'
import * as fileUtils from '../src/lib/utils/file'

vi.mock('../src/lib/utils/file', () => ({
  directoryExists: vi.fn(),
  fileExists: vi.fn(),
}))

describe('path source utils', () => {
  const sourceDir = '/Users/test'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCommandsSourcePath', () => {
    it('should return .claude/commands if it exists', async () => {
      const claudePath = resolve(sourceDir, '.claude/commands')
      vi.mocked(fileUtils.directoryExists).mockImplementation(async path => path === claudePath)

      const result = await getCommandsSourcePath(sourceDir)
      expect(result).toBe(claudePath)
    })

    it('should return commands if .claude/commands does not exist but commands exists', async () => {
      const claudePath = resolve(sourceDir, '.claude/commands')
      const fallbackPath = resolve(sourceDir, 'commands')
      vi.mocked(fileUtils.directoryExists).mockImplementation(async path => path === fallbackPath)

      const result = await getCommandsSourcePath(sourceDir)
      expect(result).toBe(fallbackPath)
    })

    it('should return .claude/commands if neither exists (default behavior for better error messages)', async () => {
      vi.mocked(fileUtils.directoryExists).mockResolvedValue(false)

      const result = await getCommandsSourcePath(sourceDir)
      expect(result).toBe(resolve(sourceDir, '.claude/commands'))
    })
  })

  describe('getSkillsSourcePath', () => {
    it('should return .claude/skills if it exists', async () => {
      const claudePath = resolve(sourceDir, '.claude/skills')
      vi.mocked(fileUtils.directoryExists).mockImplementation(async path => path === claudePath)

      const result = await getSkillsSourcePath(sourceDir)
      expect(result).toBe(claudePath)
    })

    it('should return skills if .claude/skills does not exist but skills exists', async () => {
      const claudePath = resolve(sourceDir, '.claude/skills')
      const fallbackPath = resolve(sourceDir, 'skills')
      vi.mocked(fileUtils.directoryExists).mockImplementation(async path => path === fallbackPath)

      const result = await getSkillsSourcePath(sourceDir)
      expect(result).toBe(fallbackPath)
    })

    it('should return .claude/skills if neither exists', async () => {
      vi.mocked(fileUtils.directoryExists).mockResolvedValue(false)

      const result = await getSkillsSourcePath(sourceDir)
      expect(result).toBe(resolve(sourceDir, '.claude/skills'))
    })
  })
})
