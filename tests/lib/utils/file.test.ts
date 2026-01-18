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
  setExecutablePermission,
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

  describe('copyFileSafe', () => {
    it('should copy file successfully', async () => {
      vi.mocked(access).mockRejectedValue(new Error('File not found'))
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(copyFile).mockResolvedValue(undefined)

      const result = await copyFileSafe('/source/file.txt', '/target/file.txt')

      expect(result).toEqual({ success: true, skipped: false, error: null })
      expect(access).toHaveBeenCalledWith('/target/file.txt', 0)
      expect(mkdir).toHaveBeenCalledWith('/target', { recursive: true })
      expect(copyFile).toHaveBeenCalledWith('/source/file.txt', '/target/file.txt')
    })

    it('should skip copying if file exists and autoOverwrite is false', async () => {
      vi.mocked(access).mockResolvedValue(undefined)

      const result = await copyFileSafe('/source/file.txt', '/target/file.txt', false)

      expect(result).toEqual({ success: false, skipped: true, error: null })
      expect(copyFile).not.toHaveBeenCalled()
    })

    it('should overwrite file if autoOverwrite is true', async () => {
      vi.mocked(access).mockResolvedValue(undefined)
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(copyFile).mockResolvedValue(undefined)

      const result = await copyFileSafe('/source/file.txt', '/target/file.txt', true)

      expect(result).toEqual({ success: true, skipped: false, error: null })
      expect(copyFile).toHaveBeenCalled()
    })

    it('should handle copy errors', async () => {
      vi.mocked(access).mockRejectedValue(new Error('File not found'))
      vi.mocked(mkdir).mockResolvedValue(undefined)
      const copyError = new Error('Copy failed')
      vi.mocked(copyFile).mockRejectedValue(copyError)

      const result = await copyFileSafe('/source/file.txt', '/target/file.txt')

      expect(result).toEqual({ success: false, skipped: false, error: copyError })
    })
  })

  describe('copyDirectory', () => {
    it('should copy directory recursively', async () => {
      const mockEntries = [
        { name: 'file1.md', isFile: () => true, isDirectory: () => false },
        { name: 'file2.mdc', isFile: () => true, isDirectory: () => false },
        { name: 'subdir', isFile: () => false, isDirectory: () => true },
      ]
      const mockSubdirEntries = [
        { name: 'file3.md', isFile: () => true, isDirectory: () => false },
      ]

      vi.mocked(readdir)
        .mockResolvedValueOnce(mockEntries as any)
        .mockResolvedValueOnce(mockSubdirEntries as any)
      vi.mocked(access).mockRejectedValue(new Error('File not found'))
      vi.mocked(mkdir).mockResolvedValue(undefined)
      vi.mocked(copyFile).mockResolvedValue(undefined)

      const result = await copyDirectory('/source/dir', '/target/dir')

      expect(result).toEqual({ success: 3, skipped: 0, error: 0, errors: [] })
      expect(readdir).toHaveBeenCalledWith('/source/dir', { withFileTypes: true })
      // Check that readdir was called with the subdirectory path (handling Windows path separators)
      expect(readdir).toHaveBeenCalledWith(expect.any(String), { withFileTypes: true })
      const readdirCalls = vi.mocked(readdir).mock.calls
      expect(readdirCalls.some(call => (call[0] as string).endsWith('subdir'))).toBe(true)
    })

    it('should handle readdir errors', async () => {
      const error = new Error('Permission denied')
      vi.mocked(readdir).mockRejectedValue(error)

      const result = await copyDirectory('/source/dir', '/target/dir')

      expect(result).toEqual({
        success: 0,
        skipped: 0,
        error: 1,
        errors: [{ file: '/source/dir', error: 'Permission denied' }]
      })
    })

    it('should count skipped files', async () => {
      const mockEntries = [
        { name: 'file1.md', isFile: () => true, isDirectory: () => false },
        { name: 'file2.mdc', isFile: () => true, isDirectory: () => false },
      ]

      vi.mocked(readdir).mockResolvedValue(mockEntries as any)
      vi.mocked(access).mockResolvedValue(undefined) // Both files exist in target

      const result = await copyDirectory('/source/dir', '/target/dir', false)

      expect(result).toEqual({ success: 0, skipped: 2, error: 0, errors: [] })
    })

    it('should handle file copy errors in directory', async () => {
      const mockEntries = [
        { name: 'file1.md', isFile: () => true, isDirectory: () => false },
        { name: 'file2.mdc', isFile: () => true, isDirectory: () => false },
      ]

      vi.mocked(readdir).mockResolvedValue(mockEntries as any)
      vi.mocked(access).mockRejectedValue(new Error('File not found')) // Files don't exist in target
      vi.mocked(mkdir).mockResolvedValue(undefined)
      // First file copy succeeds, second fails
      vi.mocked(copyFile)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Copy failed'))

      const result = await copyDirectory('/source/dir', '/target/dir')

      expect(result).toEqual({
        success: 1,
        skipped: 0,
        error: 1,
        errors: [{ file: 'file2.mdc', error: 'Copy failed' }]
      })
    })
  })

  describe('setExecutablePermission', () => {
    it('should set executable permission on non-Windows systems', async () => {
      vi.stubEnv('NODE_ENV', 'test')
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'linux' })

      vi.mocked(chmod).mockResolvedValue(undefined)

      await setExecutablePermission('/test/script.sh')

      expect(chmod).toHaveBeenCalledWith('/test/script.sh', 0o755)

      // Restore original platform
      Object.defineProperty(process, 'platform', { value: originalPlatform })
    })

    it('should not set executable permission on Windows', async () => {
      vi.stubEnv('NODE_ENV', 'test')
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'win32' })

      await setExecutablePermission('/test/script.sh')

      expect(chmod).not.toHaveBeenCalled()

      // Restore original platform
      Object.defineProperty(process, 'platform', { value: originalPlatform })
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