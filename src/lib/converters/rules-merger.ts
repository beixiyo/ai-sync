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

  let content = '# IDE Rules\n\n'
  content += '> 本文件由 IDE Rules 迁移脚本自动生成\n'
  content += `> 源文件：${mdcFiles.join(', ')}\n\n`
  content += '---\n\n'

  for (const file of mdcFiles) {
    const filePath = join(sourceDir, file)
    const fileContent = await readFile(filePath, 'utf-8')

    let frontmatter: Frontmatter = {}
    let body = fileContent

    const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---/)
    if (frontmatterMatch) {
      try {
        frontmatter = YAML.parse(frontmatterMatch[1]) as Frontmatter
        body = fileContent.replace(/^---[\s\S]*?---\n/, '')
      } catch (error) {
        console.warn(`Frontmatter 解析失败: ${file}`)
      }
    }

    content += `## ${frontmatter.description || file.replace('.mdc', '')}\n\n`
    content += body
    content += '\n\n---\n\n'
  }

  await ensureDirectoryExists(dirname(targetFile))
  await writeFile(targetFile, content, 'utf-8')
}

interface Frontmatter {
  description?: string
  [key: string]: unknown
}
