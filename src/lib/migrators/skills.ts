/**
 * Skills 迁移器
 *
 * 默认使用软链接模式：各工具 skills 目录中的条目以符号链接指向 Claude 源，
 * 只有源保留真实文件；配置 `symlink: false` 时回退为复制模式
 */

import type { ToolConfig, ToolKey } from '../config'
import type { MigrateOptions, MigrationStats } from './types'
import { lstat, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { copyDirectory, ensureDirectoryExists, fileExists, getMarkdownFiles, readFile, symlinkDirectory, unlinkSymlinksInto, writeFile } from '../utils/file'
import { BaseMigrator } from './base'

/**
 * Skills 迁移器类
 */
export class SkillsMigrator extends BaseMigrator {
  constructor(sourceDir: string, targetTools: ToolKey[], options: MigrateOptions, tools: Record<ToolKey, ToolConfig>) {
    super(sourceDir, targetTools, options, 'skills', tools)
  }

  /**
   * 为单个工具执行迁移
   */
  protected async migrateForTool(tool: ToolKey, targetDir: string): Promise<MigrationStats> {
    const results: MigrationStats = { success: 0, skipped: 0, error: 0, errors: [] }
    const skillConfig = this.tools[tool]?.skills

    /** 如果有自定义 transform 函数，软链接模式不适用，使用自定义转换逻辑 */
    if (skillConfig?.transform) {
      /** 先解除软链接模式遗留的链接，避免转换写入沿链接改到源文件；解除失败则中止，防止写穿 */
      if (!(await this.unlinkLegacySymlinksOrFail(targetDir, results))) {
        return results
      }
      await this.migrateWithTransform(targetDir, results, tool)
      return results
    }

    /** 软链接模式（默认）：目标条目直接链接到源，已有复制内容被替换为链接 */
    if (skillConfig?.symlink !== false) {
      /** 源与目标相同（如 claude 自身）时跳过，避免自引用 */
      if (resolve(targetDir) === resolve(this.sourceDir)) {
        return results
      }

      const stats = await symlinkDirectory(this.sourceDir, targetDir)
      this.sumStats(results, stats)
      return results
    }

    /** 复制模式：先解除软链接模式遗留的链接，确保产出真实副本而非沿链接写穿 */
    if (!(await this.unlinkLegacySymlinksOrFail(targetDir, results))) {
      return results
    }
    const stats = await copyDirectory(this.sourceDir, targetDir, this.options.autoOverwrite)
    this.sumStats(results, stats)

    return results
  }

  /**
   * 解除指向源的遗留软链接；失败时计入错误并返回 `false`（调用方应中止该工具迁移）
   *
   * 解除失败还继续写入会有沿链接改写真实源的风险，宁可失败也不冒险
   */
  private async unlinkLegacySymlinksOrFail(targetDir: string, results: MigrationStats): Promise<boolean> {
    const unlinkResult = await unlinkSymlinksInto(targetDir, this.sourceDir)

    for (const unlinkError of unlinkResult.errors) {
      results.error++
      results.errors.push(unlinkError)
      this.reportError(`解除遗留软链接失败: ${unlinkError.file}`, unlinkError.error)
    }

    return unlinkResult.errors.length === 0
  }

  /**
   * 带自定义转换的迁移
   */
  private async migrateWithTransform(
    targetDir: string,
    results: MigrationStats,
    tool: ToolKey,
  ): Promise<void> {
    const transform = this.tools[tool]?.skills?.transform
    if (!transform)
      return

    const files = await getMarkdownFiles(this.sourceDir)

    for (const file of files) {
      const sourcePath = join(this.sourceDir, file)
      const targetPath = join(targetDir, file)

      if (await fileExists(targetPath) && !this.options.autoOverwrite) {
        results.skipped++
        continue
      }

      try {
        /** 写前防御：覆盖时若目标是符号链接（含用户自建），先解除再写，避免沿链接写穿 */
        const targetStat = await lstat(targetPath).catch(() => null)
        if (targetStat?.isSymbolicLink()) {
          await rm(targetPath, { force: true })
        }

        const content = await readFile(sourcePath, 'utf-8')
        const transformed = await transform(content, file)
        await ensureDirectoryExists(dirname(targetPath))
        await writeFile(targetPath, transformed, 'utf-8')
        this.reportSuccess(`转换 Skills: ${file} (${tool})`)
        results.success++
      }
      catch (error) {
        const errorMessage = error instanceof Error
          ? error.message
          : 'Unknown error'
        this.reportError(`转换 Skills 失败: ${file}`, errorMessage)
        results.error++
        results.errors.push({ file, error: errorMessage })
      }
    }
  }
}
