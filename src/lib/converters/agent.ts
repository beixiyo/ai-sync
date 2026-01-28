import YAML from 'yaml'

/**
 * Agent 元数据结构
 */
export interface AgentMetadata {
  name?: string
  description?: string
  [key: string]: any
}

/**
 * 解析 Agent 内容，提取 Frontmatter 和主体内容
 * @param content Agent 文件的完整内容
 */
export function parseAgentContent(content: string) {
  const frontmatterRegex = /^---\s*?\n([\s\S]*?)\n---\s*?\n?/
  const match = content.match(frontmatterRegex)

  if (match) {
    const fullMatch = match[0]
    const frontmatterStr = match[1]
    try {
      const metadata = YAML.parse(frontmatterStr) || {}
      const body = content.slice(fullMatch.length)
      return {
        metadata,
        body,
        hasFrontmatter: true,
        fullMatch,
        frontmatterStr,
      }
    }
    catch {
      return {
        metadata: {} as AgentMetadata,
        body: content.slice(fullMatch.length),
        hasFrontmatter: true,
        fullMatch,
        parseError: true,
        frontmatterStr,
      }
    }
  }

  return {
    metadata: {} as AgentMetadata,
    body: content,
    hasFrontmatter: false,
  }
}

/**
 * 提取通用元数据（仅保留 name 和 description）
 */
export function extractUniversalMetadata(metadata: AgentMetadata): AgentMetadata {
  const result: AgentMetadata = {}
  if (metadata.name)
    result.name = metadata.name
  if (metadata.description)
    result.description = metadata.description
  return result
}

/**
 * 将元数据和主体内容重新组合成字符串
 */
export function stringifyAgentContent(metadata: AgentMetadata, body: string) {
  const frontmatter = YAML.stringify(metadata)
  return `---\n${frontmatter}---\n\n${body.trim()}`
}

/**
 * 转换为 OpenCode Agent 格式（需要插入 mode: subagent）
 */
export function convertToOpenCodeAgent(content: string): string {
  const { metadata, body, hasFrontmatter, parseError, frontmatterStr } = parseAgentContent(content)

  if (hasFrontmatter) {
    if (!parseError) {
      const newMetadata = extractUniversalMetadata(metadata)
      newMetadata.mode = 'subagent'
      return stringifyAgentContent(newMetadata, body)
    }

    /** 解析失败时的降级处理 */
    if (!frontmatterStr.includes('mode: subagent')) {
      return `---\nmode: subagent\n${frontmatterStr}\n---\n${body}`
    }
    return content
  }

  return `---\nmode: subagent\n---\n\n${content}`
}

/**
 * 转换为通用 Agent 格式（仅保留 name 和 description，不添加额外字段）
 */
export function convertToUniversalAgent(content: string): string {
  const { metadata, body, hasFrontmatter, parseError } = parseAgentContent(content)

  if (hasFrontmatter && !parseError) {
    const newMetadata = extractUniversalMetadata(metadata)
    /** 如果没有任何元数据，则不返回 Frontmatter 或保持原始格式 */
    if (Object.keys(newMetadata).length === 0)
      return body.trim()
    return stringifyAgentContent(newMetadata, body)
  }

  return content
}
