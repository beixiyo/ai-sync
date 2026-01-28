import { convertToOpenCodeAgent, convertToUniversalAgent } from '@lib/converters/agent'
import { describe, expect, it } from 'vitest'

describe('agent Converter', () => {
  describe('convertToUniversalAgent', () => {
    it('should extract only name and description', () => {
      const input = `---
name: my-agent
description: a cool agent
other_field: should be removed
---
Body content`
      const result = convertToUniversalAgent(input)
      expect(result).toContain('name: my-agent\n')
      expect(result).toContain('description: a cool agent\n')
      expect(result).not.toContain('other_field')
      expect(result).toContain('Body content')
    })

    it('should return body only if no name/description found', () => {
      const input = `---
other: field
---
Body content`
      const result = convertToUniversalAgent(input)
      expect(result).toBe('Body content')
    })

    it('should preserve content if no frontmatter', () => {
      const input = 'Just content'
      const result = convertToUniversalAgent(input)
      expect(result).toBe('Just content')
    })
  })

  describe('convertToOpenCodeAgent', () => {
    it('should add mode: subagent', () => {
      const input = 'Content'
      const result = convertToOpenCodeAgent(input)
      expect(result).toContain('mode: subagent')
      expect(result).toContain('Content')
    })
  })
})
