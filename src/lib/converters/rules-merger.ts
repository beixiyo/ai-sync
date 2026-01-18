/**
 * Rules 合并器 - 将多个 MDC 规则文件合并为一个 Markdown 文件
 */

import { readFile, writeFile, readdir } from 'fs/promises'
import YAML from 'yaml'
import { join, dirname } from 'path'
import { ensureDirectoryExists } from '../utils/file'

/**
 * 合并规则文件
 */
export async function mergeRules(sourceDir: string, targetFile: string): Promise<void> {
  const files = await readdir(sourceDir)
  const mdcFiles = files
    .filter(f => f.endsWith('.mdc'))
    .sort()

  if (mdcFiles.length === 0) {
    console.warn(`未找到 .mdc 文件: ${sourceDir}`)
    return
  }

  let content = ''

  for (const file of mdcFiles) {
    const filePath = join(sourceDir, file)
    const fileContent = await readFile(filePath, 'utf-8')

    let body = fileContent
    let frontmatter: Frontmatter = {}

    // 严谨匹配 YAML Frontmatter (--- ... ---)
    const frontmatterMatch = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
    if (frontmatterMatch) {
      try {
        frontmatter = YAML.parse(frontmatterMatch[1]) as Frontmatter
        body = fileContent.substring(frontmatterMatch[0].length)
      } catch (e) {
        // 如果解析失败，尝试仅剥离标记线
      }
    }

    const title = frontmatter.description || file.replace('.mdc', '')
    // 清理 body 开头的空行和可能残余的 frontmatter 标记
    const trimmedBody = body.replace(/^---[\s\S]*?---\n/g, '').trimStart()

    content += `# ${title}\n\n${trimmedBody}\n\n`
  }

  await ensureDirectoryExists(dirname(targetFile))
  await writeFile(targetFile, content, 'utf-8')
}

interface Frontmatter {
  description?: string
  [key: string]: unknown
}
