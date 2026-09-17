import { parseAgentContent, stringifyAgentContent } from './agent'

/**
 * Prompt template 转换器（Claude command → pi prompt template）
 */

/**
 * Claude command（`~/.claude/commands/*.md`）→ pi prompt template（写入 `~/.pi/agent/prompts/`）
 *
 * frontmatter 仅保留 pi 支持的 `description` 和 `argument-hint`，其余 Claude 专属字段
 * （`allowed-tools`、`model` 等）直接丢弃；
 * 参数语法 `$ARGUMENTS` / `$1` / `${1:-default}` 是 pi 语法的子集，正文原样保留
 *
 * @example
 * ```txt
 * 输入（Claude command）:             输出（pi prompt template）:
 *   ---                                ---
 *   description: 审查 PR               description: 审查 PR
 *   argument-hint: "<PR-URL>"          argument-hint: <PR-URL>
 *   allowed-tools: Bash                ---
 *   ---                                审查 $ARGUMENTS
 *   审查 $ARGUMENTS
 * ```
 */
export function convertToPiPrompt(content: string): string {
  const { metadata, body, hasFrontmatter, parseError } = parseAgentContent(content)

  if (!hasFrontmatter || parseError)
    return content

  const newMetadata: Record<string, string> = {}
  if (metadata.description)
    newMetadata.description = metadata.description
  if (metadata['argument-hint'])
    newMetadata['argument-hint'] = metadata['argument-hint']

  if (Object.keys(newMetadata).length === 0)
    return body.trim()

  return stringifyAgentContent(newMetadata, body)
}
