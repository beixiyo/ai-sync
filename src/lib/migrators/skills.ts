/**
 * Skills 迁移器
 *
 * 默认从共享源补建链接，不改动目标中的已有条目；显式配置可使用复制或转换模式
 */

import { lstat, realpath, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type { ToolConfig, ToolKey } from '../config'
import {
  copyDirectory,
  ensureDirectoryExists,
  fileExists,
  getMarkdownFiles,
  readFile,
  symlinkDirectory,
  unlinkExcludedEntries,
  unlinkSymlinksInto,
  writeFile,
} from '../utils/file'
import { BaseMigrator } from './base'
import type { MigrateOptions, MigrationStats } from './types'

/**
 * Skills 迁移器类
 */
export class SkillsMigrator extends BaseMigrator {
  private readonly excludeEntries: string[]

  constructor(sourceDir: string, targetTools: ToolKey[], options: MigrateOptions, tools: Record<ToolKey, ToolConfig>) {
    super(sourceDir, targetTools, options, 'skills', tools)

    this.excludeEntries = [...new Set(options.skills?.excludeEntries ?? ['synced'])]
    if (this.excludeEntries.some((name) => !name || name === '.' || name === '..' || /[\\\\/]/.test(name))) {
      throw new Error('skills.excludeEntries 仅支持顶级条目名称，不支持路径')
    }
  }

  /**
   * 为单个工具执行迁移
   */
  protected async migrateForTool(tool: ToolKey, targetDir: string): Promise<MigrationStats> {
    const results: MigrationStats = { success: 0, skipped: 0, error: 0, errors: [] }
    const skillConfig = this.tools[tool]?.skills

    /** Pi 等直接读源目录的工具无需同步，复制或转换也不能写回源 */
    const realSource = await realpath(this.sourceDir).catch(() => resolve(this.sourceDir))
    const realTarget = await realpath(targetDir).catch(() => resolve(targetDir))
    if (realSource === realTarget) return results

    if (!skillConfig?.transform && skillConfig?.symlink !== false) {
      const stats = await symlinkDirectory(this.sourceDir, targetDir, {
        excludeEntries: this.excludeEntries,
        legacySourceDir: this.options.legacySkillsDir,
        onSkip: (path, reason) => {
          if (reason === 'conflict') this.logger.warn(`Skill conflict; existing entry kept: ${path}`)
          else if (reason === 'reverse-source') {
            this.logger.warn(`Skill source depends on a target or legacy directory; move it to the shared source first: ${path}`)
          }
          else this.logger.warn(`Invalid skill source; skipped: ${path}`)
        },
      })
      this.sumStats(results, stats)
      return results
    }

    const cleanup = await unlinkExcludedEntries(this.sourceDir, targetDir, { excludeEntries: this.excludeEntries })
    results.errors.push(...cleanup.errors)
    results.error += cleanup.errors.length
    for (const retained of cleanup.retained) {
      this.logger.warn(`保留被排除的 Skills 条目（真实内容或无关链接），请检查后手动清理: ${retained}`)
    }
    if (cleanup.errors.length > 0) return results

    /** 自定义转换使用真实文件，不沿遗留链接写入 */
    if (skillConfig?.transform) {
      if (!(await this.unlinkLegacySymlinksOrFail(targetDir, results))) return results
      await this.migrateWithTransform(targetDir, results, tool)
      return results
    }

    /** 复制模式：先解除软链接模式遗留的链接，确保产出真实副本而非沿链接写穿 */
    if (!(await this.unlinkLegacySymlinksOrFail(targetDir, results))) {
      return results
    }
    const stats = await copyDirectory(this.sourceDir, targetDir, this.options.autoOverwrite, { excludeEntries: this.excludeEntries })
    this.sumStats(results, stats)

    return results
  }

  /**
   * 解除指向源的遗留软链接；失败时计入错误并返回 `false`（调用方应中止该工具迁移）
   *
   * 解除失败还继续写入会有沿链接改写真实源的风险，宁可失败也不冒险
   */
  private async unlinkLegacySymlinksOrFail(targetDir: string, results: MigrationStats): Promise<boolean> {
    const unlinkResult = await unlinkSymlinksInto(targetDir, this.sourceDir, { excludeEntries: this.excludeEntries })

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
    if (!transform) return

    const files = await getMarkdownFiles(this.sourceDir)

    for (const file of files) {
      if (this.excludeEntries.includes(file)) continue
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
