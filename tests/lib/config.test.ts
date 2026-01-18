import {
  getConfigDirChoiceList,
  getToolChoiceList,
  isConfigTypeSupported,
  TOOL_CONFIGS,
} from '@lib/config'
import { describe, expect, it } from 'vitest'

describe('config utils', () => {
  describe('getToolChoiceList', () => {
    it('should return all tools with name', () => {
      const result = getToolChoiceList()

      expect(result).toHaveLength(6)
      expect(result).toEqual(
        expect.arrayContaining([
          { name: 'Cursor', value: 'cursor' },
          { name: 'Claude Code', value: 'claude' },
          { name: 'OpenCode', value: 'opencode' },
          { name: 'Gemini CLI', value: 'gemini' },
          { name: 'IFlow CLI', value: 'iflow' },
          { name: 'Codex', value: 'codex' },
        ]),
      )
    })
  })

  describe('getConfigDirChoiceList', () => {
    it('should return global and project scope options', () => {
      const result = getConfigDirChoiceList()

      expect(result).toHaveLength(2)
      expect(result).toEqual([
        { name: '全局配置（所有项目共享） (Global configuration (shared by all projects))', value: 'global' },
        { name: '当前项目配置（仅当前项目） (Current project configuration (only this project))', value: 'project' },
      ])
    })
  })

  describe('isConfigTypeSupported', () => {
    it('should return true for cursor commands', () => {
      const result = isConfigTypeSupported('cursor', 'commands')
      expect(result).toBe(true)
    })

    it('should return true for all tools for skills', () => {
      const tools = ['cursor', 'claude', 'opencode', 'gemini', 'iflow', 'codex']
      tools.forEach((tool) => {
        expect(isConfigTypeSupported(tool, 'skills')).toBe(true)
      })
    })

    it('should return false for invalid tool', () => {
      const result = isConfigTypeSupported('invalid', 'commands')
      expect(result).toBe(false)
    })
  })

  describe('tOOL_CONFIGS', () => {
    it('should have all required properties for cursor', () => {
      const config = TOOL_CONFIGS.cursor

      expect(config.name).toBe('Cursor')
      expect(config.supported).toEqual(['commands', 'skills', 'rules', 'mcp'])
      expect(config.commands).toBeDefined()
      expect(config.skills).toBeDefined()
      expect(config.rules).toBeDefined()
      expect(config.mcp).toBeDefined()
    })

    it('should have all required properties for claude', () => {
      const config = TOOL_CONFIGS.claude

      expect(config.name).toBe('Claude Code')
      expect(config.supported).toEqual(['commands', 'skills', 'rules', 'mcp'])
      expect(config.rules.merge).toBe(true)
      expect(config.mcp).toBeDefined()
    })

    it('should not support hooks for opencode', () => {
      const config = TOOL_CONFIGS.opencode

      expect(config.supported).not.toContain('hooks')
    })

    it('should have convert flag for gemini commands', () => {
      const config = TOOL_CONFIGS.gemini

      expect(config.commands.convert).toBe(true)
    })

    it('should have convert flag for iflow commands', () => {
      const config = TOOL_CONFIGS.iflow

      expect(config.commands.convert).toBe(true)
    })
  })
})
