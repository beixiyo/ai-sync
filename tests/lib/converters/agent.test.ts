import { convertToOpenCodeAgent, convertToPiAgent, convertToUniversalAgent } from '@lib/converters/agent'
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

  describe('convertToPiAgent', () => {
    it('should map Claude tool names to pi builtins and drop unmappable ones', () => {
      const input = `---
name: coder
description: implementation agent
tools: Read, Bash, Glob, Grep, Task, WebFetch
---
Body`
      const result = convertToPiAgent(input)
      expect(result).toContain('tools: read, bash, find, grep\n')
      expect(result).not.toContain('Task')
      expect(result).not.toContain('WebFetch')
      expect(result).toContain('name: coder')
      expect(result).toContain('Body')
    })

    it('should omit tools entirely when none map', () => {
      const input = `---
name: planner
description: plan only
tools: Task, TodoWrite
---
Body`
      const result = convertToPiAgent(input)
      expect(result).not.toContain('tools:')
      expect(result).toContain('name: planner')
    })

    it('should keep full model ids but drop aliases', () => {
      const aliasInput = `---
name: a
description: d
model: sonnet
---
Body`
      expect(convertToPiAgent(aliasInput)).not.toContain('model')

      const idInput = `---
name: a
description: d
model: claude-haiku-4-5
---
Body`
      expect(convertToPiAgent(idInput)).toContain('model: claude-haiku-4-5')
    })
  })
})
