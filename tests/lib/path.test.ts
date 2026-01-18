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
      const result = getToolPath('cursor', 'commands', false, '')
      const expected = join('/home/user', '.cursor', 'commands')
      expect(result).toBe(expected)
    })

    it('should return project path for cursor commands', () => {
      const result = getToolPath('cursor', 'commands', true, 'C:/project')
      const expected = join('C:/project', '.cursor', 'commands')
      expect(result).toBe(expected)
    })

    it('should return global path for claude skills', () => {
      const result = getToolPath('claude', 'skills', false, '')
      const expected = join('/home/user', '.claude', 'skills')
      expect(result).toBe(expected)
    })

    it('should return global path for opencode rules', () => {
      const result = getToolPath('opencode', 'rules', false, '')
      const expected = join('/home/user', '.config/opencode', 'rules')
      expect(result).toBe(expected)
    })

    it('should return global path for gemini commands', () => {
      const result = getToolPath('gemini', 'commands', false, '')
      const expected = join('/home/user', '.gemini', 'commands')
      expect(result).toBe(expected)
    })

    it('should return global path for iflow skills', () => {
      const result = getToolPath('iflow', 'skills', false, '')
      const expected = join('/home/user', '.iflow', 'skills')
      expect(result).toBe(expected)
    })
  })
})
