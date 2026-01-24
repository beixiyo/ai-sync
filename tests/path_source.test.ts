import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCommandsSourcePath, getMCPSourcePath, getRuleSourcePath, getSkillsSourcePath } from '../src/lib/path'
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
    it('should always return .claude/commands', async () => {
      const claudePath = resolve(sourceDir, '.claude/commands')
      const result = await getCommandsSourcePath(sourceDir)
      expect(result).toBe(claudePath)
    })
  })

  describe('getSkillsSourcePath', () => {
    it('should always return .claude/skills', async () => {
      const claudePath = resolve(sourceDir, '.claude/skills')
      const result = await getSkillsSourcePath(sourceDir)
      expect(result).toBe(claudePath)
    })
  })

  describe('getMCPSourcePath', () => {
    it('should return .claude.json if it exists', async () => {
      const mcpPath = resolve(sourceDir, '.claude.json')
      vi.mocked(fileUtils.fileExists).mockImplementation(async path => path === mcpPath)

      const result = await getMCPSourcePath(sourceDir)
      expect(result).toBe(mcpPath)
    })

    it('should return .claude.json by default even if not exists', async () => {
      vi.mocked(fileUtils.fileExists).mockResolvedValue(false)
      const result = await getMCPSourcePath(sourceDir)
      expect(result).toBe(resolve(sourceDir, '.claude.json'))
    })
  })

  describe('getRuleSourcePath', () => {
    it('should return .claude/CLAUDE.md if it exists (highest priority)', async () => {
      const claudeMdPath = resolve(sourceDir, '.claude/CLAUDE.md')
      vi.mocked(fileUtils.fileExists).mockImplementation(async path => path === claudeMdPath)

      const result = await getRuleSourcePath(sourceDir)
      expect(result).toBe(claudeMdPath)
    })

    it('should return .claude/AGENTS.md if CLAUDE.md not exists in .claude/', async () => {
      const agentsMdPath = resolve(sourceDir, '.claude/AGENTS.md')
      vi.mocked(fileUtils.fileExists).mockImplementation(async (path) => {
        if (path === agentsMdPath)
          return true
        return false
      })

      const result = await getRuleSourcePath(sourceDir)
      expect(result).toBe(agentsMdPath)
    })

    it('should return root CLAUDE.md if not in .claude/', async () => {
      const rootMdPath = resolve(sourceDir, 'CLAUDE.md')
      vi.mocked(fileUtils.fileExists).mockImplementation(async (path) => {
        if (path === rootMdPath)
          return true
        return false
      })

      const result = await getRuleSourcePath(sourceDir)
      expect(result).toBe(rootMdPath)
    })
  })
})
