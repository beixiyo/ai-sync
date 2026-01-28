import type { ToolConfig } from '../types/config'
import YAML from 'yaml'

export const opencodeConfig: ToolConfig = {
  name: 'OpenCode',
  commands: {
    source: '.claude/commands',
    format: 'markdown',
    target: '~/.config/opencode/commands',
  },
  skills: {
    source: '.claude/skills',
    target: '~/.config/opencode/skills',
  },
  rules: {
    source: '.claude/CLAUDE.md',
    format: 'markdown',
    target: '~/.config/opencode/AGENTS.md',
    merge: true,
  },
  mcp: {
    source: '.claude.json',
    target: '~/.config/opencode/opencode.jsonc',
    convert: true,
  },
  agents: {
    source: '.claude/agents',
    target: '~/.config/opencode/agents',
    transform: (content: string) => {
      const frontmatterRegex = /^---\s*?\n([\s\S]*?)\n---\s*?\n?/
      const match = content.match(frontmatterRegex)

      if (match) {
        const fullMatch = match[0]
        const frontmatterStr = match[1]
        try {
          const original = YAML.parse(frontmatterStr) || {}
          const frontmatter: any = {}

          /** 仅保留原本的 name 和 description */
          if (original.name)
            frontmatter.name = original.name
          if (original.description)
            frontmatter.description = original.description

          /** 强制加上 mode: subagent */
          frontmatter.mode = 'subagent'

          const newFrontmatter = `---\n${YAML.stringify(frontmatter)}---\n`
          return content.replace(fullMatch, newFrontmatter)
        }
        catch {
          /** 如果解析失败，回退到简单的字符串插入，确保 mode: subagent 存在 */
          if (!frontmatterStr.includes('mode: subagent')) {
            const newFrontmatter = `---\nmode: subagent\n${frontmatterStr}\n---\n`
            return content.replace(fullMatch, newFrontmatter)
          }
          return content
        }
      }
      /** 如果没有 frontmatter，则创建一个 */
      return `---\nmode: subagent\n---\n\n${content}`
    },
  },
  supported: ['commands', 'skills', 'rules', 'mcp', 'agents'],
}
