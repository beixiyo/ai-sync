/**
 * Markdown 转 TOML 转换器
 */

import YAML from 'yaml'
import { readFile, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { ensureDirectoryExists } from '../utils/file'

/**
 * 将 Markdown 转换为 TOML 格式
 */
export async function convertMarkdownToTOML(sourcePath: string, targetPath: string): Promise<void> {
  const content = await readFile(sourcePath, 'utf-8')

  let frontmatter: Frontmatter = {}
  let prompt = content

  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (frontmatterMatch) {
    try {
      frontmatter = YAML.parse(frontmatterMatch[1]) as Frontmatter
      prompt = content.replace(/^---[\s\S]*?---\n/, '')
    } catch (error) {
      console.warn(`Frontmatter 解析失败: ${sourcePath}`)
    }
  }

  const description = frontmatter.description || ''

  prompt = convertParameterSyntax(prompt)
  prompt = removeUnsupportedConfig(prompt)

  const toml = generateTOML(description, prompt)

  await ensureDirectoryExists(dirname(targetPath))
  await writeFile(targetPath, toml, 'utf-8')
}

/**
 * 转换参数语法
 */
function convertParameterSyntax(prompt: string): string {
  prompt = prompt.replace(/\$ARGUMENTS/g, '{{args}}')
  prompt = prompt.replace(/\$(\d+)/g, '{{arg$1}}')
  prompt = prompt.replace(/`([^`]+)`/g, '!{$1}')
  return prompt
}

/**
 * 移除不支持的配置
 */
function removeUnsupportedConfig(prompt: string): string {
  prompt = prompt.replace(/allowed-tools:.*\n/g, '')
  prompt = prompt.replace(/argument-hint:.*\n/g, '')
  prompt = prompt.replace(/context:.*\n/g, '')
  return prompt
}

/**
 * 生成 TOML 格式
 */
function generateTOML(description: string, prompt: string): string {
  let toml = `prompt = """\n${prompt.trim()}\n"""\n`
  if (description) {
    toml = `description = "${description}"\n${toml}`
  }
  return toml
}

interface Frontmatter {
  description?: string
  [key: string]: unknown
}