import { convertToPiPrompt } from '@lib/converters/prompt'
import { describe, expect, it } from 'vitest'

describe('prompt Converter', () => {
  describe('convertToPiPrompt', () => {
    it('should keep only description and argument-hint, drop Claude-specific fields', () => {
      const input = `---
description: Review a PR
argument-hint: "<PR-URL>"
allowed-tools: Bash, Read
model: sonnet
---
Review $ARGUMENTS carefully`
      const result = convertToPiPrompt(input)
      expect(result).toContain('description: Review a PR')
      expect(result).toContain('argument-hint: <PR-URL>')
      expect(result).not.toContain('allowed-tools')
      expect(result).not.toContain('model:')
      expect(result).toContain('Review $ARGUMENTS carefully')
    })

    it('should return body only when no useful frontmatter', () => {
      const input = `---
allowed-tools: Bash
---
Just a prompt`
      const result = convertToPiPrompt(input)
      expect(result).toBe('Just a prompt')
    })

    it('should preserve content if no frontmatter', () => {
      const input = 'Plain prompt'
      const result = convertToPiPrompt(input)
      expect(result).toBe('Plain prompt')
    })
  })
})
