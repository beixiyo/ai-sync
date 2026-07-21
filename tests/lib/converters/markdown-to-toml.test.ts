import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import TOML from '@iarna/toml'
import { convertMarkdownToTOML } from '@lib/converters/markdown-to-toml'
import { afterEach, describe, expect, it } from 'vitest'

describe('markdown to TOML Converter', () => {
  const tempDirectories: string[] = []

  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map(path => rm(path, { force: true, recursive: true })))
  })

  it('should preserve inline code while converting positional arguments', async () => {
    const prompt = await convertPrompt('创建名为 `$1` 的组件')

    expect(prompt).toBe('创建名为 `{{arg1}}` 的组件')
  })

  it('should convert Claude shell execution without duplicating the prefix', async () => {
    const prompt = await convertPrompt('当前分支：!`git branch --show-current`')

    expect(prompt).toBe('当前分支：!{git branch --show-current}')
  })

  it('should preserve fenced code blocks as prompt examples', async () => {
    const source = `示例代码：

\`\`\`ts
const componentName = '$1'
console.log(componentName)
\`\`\``
    const prompt = await convertPrompt(source)

    expect(prompt).toBe(`示例代码：

\`\`\`ts
const componentName = '{{arg1}}'
console.log(componentName)
\`\`\``)
  })

  async function convertPrompt(source: string): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), 'ai-sync-markdown-to-toml-'))
    tempDirectories.push(directory)

    const sourcePath = join(directory, 'command.md')
    const targetPath = join(directory, 'command.toml')

    await writeFile(sourcePath, source, 'utf-8')
    await convertMarkdownToTOML(sourcePath, targetPath)

    const output = TOML.parse(await readFile(targetPath, 'utf-8'))
    if (typeof output.prompt !== 'string')
      throw new TypeError('转换结果缺少 prompt 字符串')

    return output.prompt
  }
})
