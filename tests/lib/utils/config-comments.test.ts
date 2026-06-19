import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import TOML from '@iarna/toml'
import { readTOMLFile, writeJSONFile, writeTOMLFile } from '@utils/file'
import { parse as parseJSONC } from 'comment-json'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * 针对「迁移写回时保留注释」逻辑的真实文件往返测试
 *
 * 重点覆盖自研的 TOML 合并/剥离分支（mergeTOMLPreservingComments），
 * 以及第三方 comment-json 在 JSONC 上的注释保留
 */

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ai-sync-comments-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('writeTOMLFile：注释保留与正确性', () => {
  it('全新文件：无原文时直接序列化，输出合法且结构正确', async () => {
    const p = join(dir, 'new.toml')
    await writeTOMLFile(p, {
      mcp_servers: {
        'local-mcp': { command: 'npx', args: ['x'], default_tools_approval_mode: 'approve' },
      },
    })

    const re = await readTOMLFile<any>(p)
    expect(Object.keys(re.mcp_servers)).toEqual(['local-mcp'])
    expect(re.mcp_servers['local-mcp'].default_tools_approval_mode).toBe('approve')
  })

  it('原文无 mcp_servers：保留无关注释，新增 server 写为独立 section', async () => {
    const p = join(dir, 'c.toml')
    await writeFile(p, '# 顶部注释（勿删）\nmodel = "o3"  # 偏好模型\n', 'utf-8')

    await writeTOMLFile(p, {
      model: 'o3',
      mcp_servers: {
        'local-mcp': { command: 'npx', env: { NODE_ENV: 'dev' }, default_tools_approval_mode: 'approve' },
        'remote-mcp': { url: 'http://localhost:3000', default_tools_approval_mode: 'approve' },
      },
    })

    const text = await readFile(p, 'utf-8')
    expect(text).toContain('# 顶部注释（勿删）')
    expect(text).toContain('# 偏好模型')
    expect(text).toContain('[mcp_servers.local-mcp]')

    const re: any = TOML.parse(text)
    expect(Object.keys(re.mcp_servers).sort()).toEqual(['local-mcp', 'remote-mcp'])
    /** 未泄漏到根级 */
    expect('local-mcp' in re).toBe(false)
    /** 嵌套子表正确 */
    expect(re.mcp_servers['local-mcp'].env).toEqual({ NODE_ENV: 'dev' })
  })

  it('原文已有旧 mcp_servers：旧 server 被替换，其他带注释的表完整保留', async () => {
    const p = join(dir, 'c.toml')
    await writeFile(
      p,
      '# 配置\nmodel = "o3"\n\n[mcp_servers.stale]\ncommand = "old"\n\n[sandbox]\nmode = "ro"  # 保留我\n',
      'utf-8',
    )

    await writeTOMLFile(p, {
      model: 'o3',
      sandbox: { mode: 'ro' },
      mcp_servers: {
        fresh: { command: 'bun', default_tools_approval_mode: 'approve' },
      },
    })

    const text = await readFile(p, 'utf-8')
    /** 无关表及其注释保留 */
    expect(text).toContain('[sandbox]')
    expect(text).toContain('# 保留我')

    const re: any = TOML.parse(text)
    /** 旧 server 被剥离，仅剩新 server */
    expect(Object.keys(re.mcp_servers)).toEqual(['fresh'])
    expect(re.sandbox).toEqual({ mode: 'ro' })
  })

  it('无变化：data 与原文一致时原样保留', async () => {
    const p = join(dir, 'c.toml')
    const original = '# 不要动我\nmodel = "o3"\n\n[mcp_servers.a]\ncommand = "node"\n'
    await writeFile(p, original, 'utf-8')

    await writeTOMLFile(p, { model: 'o3', mcp_servers: { a: { command: 'node' } } })

    const text = await readFile(p, 'utf-8')
    expect(text).toContain('# 不要动我')
    expect(text).toContain('[mcp_servers.a]')
  })

  it('回退：根级标量发生变化时回退到完整序列化（值正确，注释可丢）', async () => {
    const p = join(dir, 'c.toml')
    await writeFile(p, '# c\nmodel = "o3"\n', 'utf-8')

    /** model 由标量 o3 → o4，属根级标量变更，按行剥离不安全 → 回退 */
    await writeTOMLFile(p, { model: 'o4', mcp_servers: { a: { command: 'node' } } })

    const re = await readTOMLFile<any>(p)
    expect(re.model).toBe('o4')
    expect(Object.keys(re.mcp_servers)).toEqual(['a'])
  })

  it('回退：原文不是合法 TOML 时安全完整重写', async () => {
    const p = join(dir, 'broken.toml')
    await writeFile(p, 'this is = = not valid toml [[[', 'utf-8')

    await writeTOMLFile(p, { mcp_servers: { a: { command: 'node' } } })

    const re = await readTOMLFile<any>(p)
    expect(Object.keys(re.mcp_servers)).toEqual(['a'])
  })

  it('剥离支持带引号的表名', async () => {
    const p = join(dir, 'c.toml')
    await writeFile(
      p,
      '# top\n[other]\nx = 1  # 保留\n\n["mcp_servers"]\n\n["mcp_servers".old]\ncommand = "old"\n',
      'utf-8',
    )

    await writeTOMLFile(p, { other: { x: 1 }, mcp_servers: { fresh: { command: 'bun' } } })

    const re = await readTOMLFile<any>(p)
    expect(Object.keys(re.mcp_servers)).toEqual(['fresh'])
    expect(re.other).toEqual({ x: 1 })
    expect(await readFile(p, 'utf-8')).toContain('# 保留')
  })
})

describe('writeJSONFile：JSONC 注释保留（comment-json）', () => {
  it('保留未改动字段的注释', async () => {
    const p = join(dir, 'cfg.jsonc')
    await writeFile(p, '{\n  // 主题，勿删\n  "theme": "dark",\n  "mcpServers": {}\n}', 'utf-8')

    const obj = parseJSONC(await readFile(p, 'utf-8')) as any
    obj.mcpServers = { fresh: { command: 'node' } }
    await writeJSONFile(p, obj)

    const text = await readFile(p, 'utf-8')
    expect(text).toContain('// 主题，勿删')
    expect(text).toContain('"theme": "dark"')

    /** 输出保留了注释，需用 JSONC 解析读回 */
    const re = parseJSONC(await readFile(p, 'utf-8')) as any
    expect(re.mcpServers.fresh.command).toBe('node')
  })

  it('普通对象（无注释）输出标准 JSON', async () => {
    const p = join(dir, 'plain.json')
    await writeJSONFile(p, { a: 1, b: { c: 2 } })
    expect(JSON.parse(await readFile(p, 'utf-8'))).toEqual({ a: 1, b: { c: 2 } })
  })
})
