import YAML from 'yaml'

/**
 * Agent 定义转换器
 *
 * 统一源格式为 Claude Code agent（`~/.claude/agents/*.md`，YAML frontmatter + 系统提示正文），
 * 按目标工具（OpenCode / Codex / pi-subagents）裁剪或补全 frontmatter 字段
 */

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
 * Claude agent → OpenCode agent（写入 `~/.config/opencode/agent/`）
 *
 * OpenCode 的 subagent 必须显式声明 `mode: subagent`，转换时补上该字段，
 * 并丢弃 OpenCode 不识别的 `tools` / `model` 等字段
 *
 * @example
 * ```txt
 * 输入（Claude）:                    输出（OpenCode）:
 *   ---                                ---
 *   name: reviewer                     name: reviewer
 *   description: 代码审查              description: 代码审查
 *   tools: Read                        mode: subagent
 *   ---                                ---
 *   你是代码审查员                     你是代码审查员
 * ```
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
 * Claude agent → 通用最小格式（仅保留 name / description，不添加额外字段）
 *
 * 供与 Claude frontmatter 兼容、但不需要额外字段的工具使用（Codex 等）
 *
 * @example
 * ```txt
 * 输入（Claude）:                    输出（通用）:
 *   ---                                ---
 *   name: reviewer                     name: reviewer
 *   description: 代码审查              description: 代码审查
 *   tools: Read                        ---
 *   model: sonnet                      你是代码审查员
 *   ---
 *   你是代码审查员
 * ```
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

/**
 * Claude → pi-subagents 工具名映射
 * Glob 语义对应 pi 的 find；其余 pi 没有的内置工具（Task/WebFetch 等）不映射
 */
const PI_TOOL_NAME_MAP: Record<string, string> = {
  read: 'read',
  write: 'write',
  edit: 'edit',
  bash: 'bash',
  grep: 'grep',
  glob: 'find',
  ls: 'ls',
}

/**
 * 映射 Claude 工具列表到 pi 内置工具，全部无法映射时返回 undefined（继承默认工具集）
 */
function mapPiTools(tools: unknown): string[] | undefined {
  const list = Array.isArray(tools)
    ? tools.map(tool => String(tool))
    : typeof tools === 'string' ? tools.split(',') : []

  const mapped = list
    .map(tool => PI_TOOL_NAME_MAP[tool.trim().toLowerCase()])
    .filter(Boolean)

  return mapped.length > 0 ? [...new Set(mapped)] : undefined
}

/**
 * 仅保留完整模型 ID（含连字符，如 claude-haiku-4-5）
 * sonnet / opus / haiku 等 Claude 别名对 pi 无意义，丢弃后子 agent 继承默认模型
 */
function mapPiModel(model: unknown): string | undefined {
  if (typeof model !== 'string')
    return undefined
  const trimmed = model.trim()
  return trimmed.includes('-') ? trimmed : undefined
}

/**
 * Claude agent → pi-subagents agent（写入 `~/.pi/agent/agents/`）
 *
 * - 保留 name / description
 * - tools 映射到 pi 内置工具名（`Glob` → `find`），无法映射的丢弃（如 Task / WebFetch）
 * - model 仅保留完整模型 ID（如 claude-haiku-4-5），`sonnet` 等别名丢弃后继承默认模型
 *
 * @example
 * ```txt
 * 输入（Claude）:                    输出（pi-subagents）:
 *   ---                                ---
 *   name: coder                        name: coder
 *   description: 实现代码              description: 实现代码
 *   tools: Read, Bash, Glob, Task      tools: read, bash, find
 *   model: sonnet                      ---
 *   ---                                实现代码
 *   实现代码
 * ```
 */
export function convertToPiAgent(content: string): string {
  const { metadata, body, hasFrontmatter, parseError } = parseAgentContent(content)

  if (hasFrontmatter && !parseError) {
    const newMetadata = extractUniversalMetadata(metadata)
    const tools = mapPiTools(metadata.tools)
    if (tools)
      newMetadata.tools = tools.join(', ')
    const model = mapPiModel(metadata.model)
    if (model)
      newMetadata.model = model
    if (Object.keys(newMetadata).length === 0)
      return body.trim()
    return stringifyAgentContent(newMetadata, body)
  }

  return content
}
