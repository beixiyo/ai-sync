import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'path'
import { readFile, writeFile, mkdir, access, stat, readdir, copyFile, chmod } from 'fs/promises'
import {
  ensureDirectoryExists,
  fileExists,
  directoryExists,
  copyFileSafe,
  copyDirectory,
  getMarkdownFiles,
  readJSONFile,
  writeJSONFile,
} from '@utils/file'

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  copyFile: vi.fn(),
  access: vi.fn(),
  constants: {
    F_OK: 0,
  },
  chmod: vi.fn(),
}))

describe('file utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ensureDirectoryExists', () => {
    it('should create directory successfully', async () => {
      vi.mocked(mkdir).mockResolvedValue(undefined)

      await ensureDirectoryExists('/test/dir')

      expect(mkdir).toHaveBeenCalledWith('/test/dir', { recursive: true })
    })

    it('should handle EEXIST error gracefully', async () => {
      const error = new Error('Directory exists') as NodeJS.ErrnoException
      error.code = 'EEXIST'
      vi.mocked(mkdir).mockRejectedValue(error)

      await expect(ensureDirectoryExists('/test/dir')).resolves.not.toThrow()
    })

    it('should throw non-EEXIST errors', async () => {
      const error = new Error('Permission denied') as NodeJS.ErrnoException
      error.code = 'EACCES'
      vi.mocked(mkdir).mockRejectedValue(error)

      await expect(ensureDirectoryExists('/test/dir')).rejects.toThrow()
    })
  })

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      vi.mocked(access).mockResolvedValue(undefined)

      const result = await fileExists('/test/file.txt')

      expect(result).toBe(true)
      expect(access).toHaveBeenCalledWith('/test/file.txt', 0)
    })

    it('should return false when file does not exist', async () => {
      vi.mocked(access).mockRejectedValue(new Error('File not found'))

      const result = await fileExists('/test/file.txt')

      expect(result).toBe(false)
    })
  })

  describe('directoryExists', () => {
    it('should return true when directory exists', async () => {
      const mockStats = { isDirectory: () => true }
      vi.mocked(stat).mockResolvedValue(mockStats as any)

      const result = await directoryExists('/test/dir')

      expect(result).toBe(true)
    })

    it('should return false when path is not a directory', async () => {
      const mockStats = { isDirectory: () => false }
      vi.mocked(stat).mockResolvedValue(mockStats as any)

      const result = await directoryExists('/test/file.txt')

      expect(result).toBe(false)
    })

    it('should return false when stat fails', async () => {
      vi.mocked(stat).mockRejectedValue(new Error('Not found'))

      const result = await directoryExists('/test/dir')

      expect(result).toBe(false)
    })
  })

  describe('getMarkdownFiles', () => {
    it('should return markdown files', async () => {
      const mockEntries = [
        { name: 'test.md', isFile: () => true },
        { name: 'test.mdc', isFile: () => true },
        { name: 'test.txt', isFile: () => true },
      ]
      vi.mocked(readdir).mockResolvedValue(mockEntries as any)

      const result = await getMarkdownFiles('/test/dir')

      expect(result).toEqual(['test.md', 'test.mdc'])
    })

    it('should handle readdir errors gracefully', async () => {
      vi.mocked(readdir).mockRejectedValue(new Error('Permission denied'))

      const result = await getMarkdownFiles('/test/dir')

      expect(result).toEqual([])
    })
  })

  describe('readJSONFile', () => {
    it('should parse JSON file', async () => {
      const mockData = { key: 'value' }
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockData))

      const result = await readJSONFile('/test/file.json')

      expect(result).toEqual(mockData)
    })
  })

  describe('writeJSONFile', () => {
    it('should write JSON file with proper formatting', async () => {
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(writeFile).mockResolvedValue(undefined)

      const data = { key: 'value', nested: { value: 2 } }
      await writeJSONFile('/test/file.json', data)

      expect(writeFile).toHaveBeenCalledWith(
        '/test/file.json',
        JSON.stringify(data, null, 2),
        'utf-8'
      )
    })
  })
})