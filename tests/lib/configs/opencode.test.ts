import { TOOL_CONFIGS } from '@lib/config'
import { describe, expect, it } from 'vitest'

describe('openCode Agent Transform', () => {
  const transform = TOOL_CONFIGS.opencode.agents?.transform

  it('should be defined', () => {
    expect(transform).toBeDefined()
  })

  if (transform) {
    it('should add mode: subagent and keep only name/description', async () => {
      const input = `---
name: test-agent
description: test
other: field
---

Content here`

      const result = await transform(input, 'test.md')

      /** 验证 mode: subagent 被正确插入 */
      expect(result).toContain('mode: subagent\n')
      /** 验证只保留了 name, description 和 mode */
      expect(result).toContain('name: test-agent\n')
      expect(result).toContain('description: test\n')
      expect(result).not.toContain('other: field')
      /** 验证格式 */
      expect(result).toMatch(/^---\n/)
      expect(result).toMatch(/---\n\nContent here$/)
    })

    it('should create new frontmatter if none exists', async () => {
      const input = `Just some content`

      const result = await transform(input, 'test.md')

      expect(result).toBe(`---\nmode: subagent\n---\n\nJust some content`)
    })

    it('should keep existing name/description and force mode: subagent', async () => {
      const input = `---
mode: user
name: already-exists
---`

      const result = await transform(input, 'test.md')

      expect(result).toContain('mode: subagent\n')
      expect(result).toContain('name: already-exists\n')
      expect(result).not.toContain('mode: user')
    })

    it('should handle frontmatter with different spacing and normalize it', async () => {
      const input = `--- 
name: spaced
---
Content`

      const result = await transform(input, 'test.md')
      expect(result).toContain('mode: subagent')
      expect(result).toContain('name: spaced')
      expect(result).toMatch(/^---\n/)
    })
  }
})
