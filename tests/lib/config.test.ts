import { describe, it, expect } from 'vitest'
import {
  getToolChoiceList,
  getScopeChoiceList,
  isConfigTypeSupported,
  TOOL_CONFIGS,
} from '@lib/config'

describe('config utils', () => {
  describe('getToolChoiceList', () => {
    it('should return all tools with emoji and name', () => {
      const result = getToolChoiceList()

      expect(result).toHaveLength(5)
      expect(result).toEqual(
        expect.arrayContaining([
          { name: '🎯 Cursor', value: 'cursor' },
          { name: '🤖 Claude Code', value: 'claude' },
          { name: '🚀 OpenCode', value: 'opencode' },
          { name: '💎 Gemini CLI', value: 'gemini' },
          { name: '⚡ IFlow CLI', value: 'iflow' },
        ])
      )
    })
  })

  describe('getScopeChoiceList', () => {
    it('should return global and project scope options', () => {
      const result = getScopeChoiceList()

      expect(result).toHaveLength(2)
      expect(result).toEqual([
        { name: '🌍 全局配置（~/.tool/）', value: 'global' },
        { name: '📁 项目配置（./.tool/）', value: 'project' },
      ])
    })
  })

  describe('isConfigTypeSupported', () => {
    it('should return true for cursor commands', () => {
      const result = isConfigTypeSupported('cursor', 'commands')
      expect(result).toBe(true)
    })

    it('should return true for claude hooks', () => {
      const result = isConfigTypeSupported('claude', 'hooks')
      expect(result).toBe(true)
    })

    it('should return false for opencode hooks', () => {
      const result = isConfigTypeSupported('opencode', 'hooks')
      expect(result).toBe(false)
    })

    it('should return false for gemini hooks', () => {
      const result = isConfigTypeSupported('gemini', 'hooks')
      expect(result).toBe(false)
    })

    it('should return false for iflow hooks', () => {
      const result = isConfigTypeSupported('iflow', 'hooks')
      expect(result).toBe(false)
    })

    it('should return true for all tools for skills', () => {
      const tools = ['cursor', 'claude', 'opencode', 'gemini', 'iflow']
      tools.forEach((tool) => {
        expect(isConfigTypeSupported(tool, 'skills')).toBe(true)
      })
    })

    it('should return false for invalid tool', () => {
      const result = isConfigTypeSupported('invalid', 'commands')
      expect(result).toBe(false)
    })
  })

  describe('TOOL_CONFIGS', () => {
    it('should have all required properties for cursor', () => {
      const config = TOOL_CONFIGS.cursor

      expect(config.name).toBe('Cursor')
      expect(config.emoji).toBe('🎯')
      expect(config.supported).toEqual(['commands', 'skills', 'rules', 'hooks'])
      expect(config.commands).toBeDefined()
      expect(config.skills).toBeDefined()
      expect(config.rules).toBeDefined()
      expect(config.hooks).toBeDefined()
    })

    it('should have all required properties for claude', () => {
      const config = TOOL_CONFIGS.claude

      expect(config.name).toBe('Claude Code')
      expect(config.emoji).toBe('🤖')
      expect(config.supported).toEqual(['commands', 'skills', 'rules', 'hooks'])
      expect(config.rules.merge).toBe(true)
      expect(config.hooks.convert).toBe(true)
    })

    it('should not support hooks for opencode', () => {
      const config = TOOL_CONFIGS.opencode

      expect(config.hooks.supported).toBe(false)
      expect(config.supported).not.toContain('hooks')
    })

    it('should have convert flag for gemini commands', () => {
      const config = TOOL_CONFIGS.gemini

      expect(config.commands.convert).toBe(true)
      expect(config.hooks.supported).toBe(false)
    })

    it('should have convert flag for iflow commands', () => {
      const config = TOOL_CONFIGS.iflow

      expect(config.commands.convert).toBe(true)
      expect(config.hooks.supported).toBe(false)
    })
  })
})