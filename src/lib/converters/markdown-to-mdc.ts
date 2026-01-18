import { readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { ensureDirectoryExists } from '../utils/file'

/**
 * 将Markdown文件转换为MDC格式并添加元数据
 */
export async function markdownToMdc(sourcePath: string, targetPath: string): Promise<boolean> {
  try {
    // 读取源文件内容
    const content = await readFile(sourcePath, 'utf-8')

    // 检查是否已有frontmatter
    const hasFrontmatter = content.startsWith('---\n')

    let mdcContent = content

    if (!hasFrontmatter) {
      // 从文件名生成description
      const fileName = sourcePath.split(/[/\\]/).pop()?.replace(/\.md$/, '') || ''
      const description = fileName.replace(/([a-z])([A-Z])/g, '$1 $2').trim()

      // 添加frontmatter
      const frontmatter = `---
description: ${description}
alwaysApply: true
---\n\n`

      mdcContent = frontmatter + content
    }

    // 确保目标目录存在
    await ensureDirectoryExists(dirname(targetPath))

    // 写入转换后的内容
    await writeFile(targetPath, mdcContent, 'utf-8')
    return true
  }
  catch (error) {
    console.error(`转换文件失败: ${sourcePath} → ${targetPath}`, error)
    return false
  }
}
