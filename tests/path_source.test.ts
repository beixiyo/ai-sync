import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getCommandsSourcePath, getMCPSourcePath, getSkillsSourcePath } from '../src/lib/path'

describe('path source utils', () => {
  const sourceDir = '/Users/test'

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
    it('should always return .claude.json', async () => {
      const result = await getMCPSourcePath(sourceDir)
      expect(result).toBe(resolve(sourceDir, '.claude.json'))
    })
  })
})
