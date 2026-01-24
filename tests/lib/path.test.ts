import { join } from 'node:path'
import { expandHome, getToolPath, normalizePath } from '@lib/path'
import { describe, expect, it, vi } from 'vitest'

// Mock os module
vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/user'),
}))

describe('path utils', () => {
  describe('expandHome', () => {
    it('should expand ~ to home directory', () => {
      const result = expandHome('~/test/path')
      const expected = join('/home/user', 'test/path')
      expect(result).toBe(expected)
    })

    it('should not modify paths without ~', () => {
      const result = expandHome('/absolute/path')
      expect(result).toBe('/absolute/path')
    })

    it('should handle paths starting with ~/', () => {
      const result = expandHome('~/Documents')
      const expected = join('/home/user', 'Documents')
      expect(result).toBe(expected)
    })
  })

  describe('normalizePath', () => {
    it('should convert backslashes to forward slashes', () => {
      const result = normalizePath('C:\\Users\\test\\file.txt')
      expect(result).toBe('C:/Users/test/file.txt')
    })

    it('should not modify paths with forward slashes', () => {
      const result = normalizePath('/home/user/file.txt')
      expect(result).toBe('/home/user/file.txt')
    })

    it('should handle mixed path separators', () => {
      const result = normalizePath('C:/Users\\test/file.txt')
      expect(result).toBe('C:/Users/test/file.txt')
    })
  })

  describe('getToolPath', () => {
    it('should return global path for cursor commands', () => {
      const result = normalizePath(getToolPath('cursor', 'commands', false, '')).replace(/^[A-Z]:/, '')
      expect(result).toBe('/home/user/.cursor/commands')
    })

    it('should return project path for cursor commands', () => {
      const result = normalizePath(getToolPath('cursor', 'commands', true, '/home/user/project')).replace(/^[A-Z]:/, '')
      expect(result).toBe('/home/user/project/.cursor/commands')
    })

    it('should return global path for claude skills', () => {
      const result = normalizePath(getToolPath('claude', 'skills', false, '')).replace(/^[A-Z]:/, '')
      expect(result).toBe('/home/user/.claude/skills')
    })

    it('should return global path for opencode rules', () => {
      const result = normalizePath(getToolPath('opencode', 'rules', false, '')).replace(/^[A-Z]:/, '')
      expect(result).toBe('/home/user/.config/opencode/rules')
    })

    it('should return global path for gemini commands', () => {
      const result = normalizePath(getToolPath('gemini', 'commands', false, '')).replace(/^[A-Z]:/, '')
      expect(result).toBe('/home/user/.gemini/commands')
    })

    it('should return global path for iflow skills', () => {
      const result = normalizePath(getToolPath('iflow', 'skills', false, '')).replace(/^[A-Z]:/, '')
      expect(result).toBe('/home/user/.iflow/skills')
    })
  })
})
