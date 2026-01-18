/**
 * Rules 迁移器
 */

import type { ToolConfig, ToolKey } from '../config'
import type { MigrateOptions, MigrationStats } from './types'
import { readdir, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import chalk from 'chalk'
import { markdownToMdc } from '../converters/markdown-to-mdc'
import { mergeRules } from '../converters/rules-merger'
import { expandHome } from '../path'
import { copyDirectory, copyFileSafe, ensureDirectoryExists, fileExists, readFile, writeFile } from '../utils/file'
import { BaseMigrator } from './base'

/**
 * Rules 迁移器类
 */
export class RulesMigrator extends BaseMigrator {
  constructor(sourceDir: string, targetTools: ToolKey[], options: MigrateOptions, tools: Record<ToolKey, ToolConfig>) {
    super(sourceDir, targetTools, options, 'rules', tools)
  }

  /**
   * 为单个工具执行迁移
   */
  protected async migrateForTool(tool: ToolKey, targetDir: string): Promise<MigrationStats> {
    const results: MigrationStats = { success: 0, skipped: 0, error: 0, errors: [] }
    const toolConfig = this.tools[tool]

    /** 检查源路径是文件还是目录 */
    let isSourceFile = false
    try {
      const sourceStats = await stat(this.sourceDir)
      isSourceFile = sourceStats.isFile()
    }
    catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'Unknown error'
      results.error++
      results.errors.push({ file: this.sourceDir, error: errorMessage })
      return results
    }

    if (isSourceFile) {
      await this.migrateSingleFile(tool, results)
    }
    else {
      if (toolConfig.rules.customMerge) {
        await this.migrateWithCustomMerge(tool, results)
      }
      else if (toolConfig.rules.merge) {
        await this.migrateWithMerge(tool, results)
      }
      else {
        await this.migrateDirect(tool, targetDir, results)
      }
    }

    return results
  }

  /**
   * 直接迁移 (带格式转换或直接复制)
   */
  private async migrateDirect(tool: ToolKey, targetDir: string, results: MigrationStats): Promise<void> {
    const toolConfig = this.tools[tool]

    /** 如果有自定义 transform 函数，使用自定义逻辑处理目录 */
    if (toolConfig?.rules?.transform) {
      await this.copyWithTransform(this.sourceDir, targetDir, results, toolConfig.rules.transform)
      return
    }

    /** 检查是否需要格式转换 (claude -> cursor) */
    const needsConversion = this.sourceDir.endsWith('.claude') && tool === 'cursor'

    if (needsConversion) {
      await this.copyWithConversion(this.sourceDir, targetDir, results)
    }
    else {
      const stats = await copyDirectory(this.sourceDir, targetDir, this.options.autoOverwrite)
      this.sumStats(results, stats)
    }
  }

  /**
   * 获取规则目标文件路径 (针对合并场景)
   */
  private getTargetFilePath(tool: ToolKey): string {
    const toolConfig = this.tools[tool]
    if (this.options.isProject) {
      const basePath = this.getTargetDir(tool)
      const fileName = toolConfig.rules.target?.split('/').pop() || ''
      return resolve(basePath, '../', fileName)
    }
    else {
      return expandHome(toolConfig.rules.target || '')
    }
  }

  /**
   * 自定义合并迁移
   */
  private async migrateWithCustomMerge(tool: ToolKey, results: MigrationStats): Promise<void> {
    const customMerge = this.tools[tool]?.rules?.customMerge
    if (!customMerge)
      return

    const targetFile = this.getTargetFilePath(tool)

    try {
      await customMerge(this.sourceDir, targetFile)
      console.log(chalk.green(`✓ 自定义合并 Rules → ${tool} (Custom merge Rules → ${tool})`))
      results.success++
    }
    catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'Unknown error'
      console.error(chalk.red(`✗ 自定义合并 Rules 失败 (${tool}) (Custom merge Rules failed (${tool}))`), errorMessage)
      results.error++
      results.errors.push({ file: targetFile, error: errorMessage })
    }
  }

  /**
   * 合并迁移
   */
  private async migrateWithMerge(tool: ToolKey, results: MigrationStats): Promise<void> {
    const targetFile = this.getTargetFilePath(tool)

    try {
      await mergeRules(this.sourceDir, targetFile)
      console.log(chalk.green(`✓ 合并 Rules → ${tool} (Merge Rules → ${tool})`))
      results.success++
    }
    catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'Unknown error'
      console.error(chalk.red(`✗ 合并 Rules 失败 (${tool}) (Merge Rules failed (${tool}))`), errorMessage)
      results.error++
      results.errors.push({ file: targetFile, error: errorMessage })
    }
  }

  /**
   * 单个文件迁移
   */
  private async migrateSingleFile(tool: ToolKey, results: MigrationStats): Promise<void> {
    const targetFile = this.getTargetFilePath(tool)

    try {
      const copyResult = await copyFileSafe(this.sourceDir, targetFile, this.options.autoOverwrite)
      if (copyResult.success) {
        console.log(chalk.green(`✓ 复制 Rules 文件 → ${tool} (Copy Rules file → ${tool})`))
        results.success++
      }
      else {
        console.log(chalk.yellow(`⚠ 跳过 Rules 文件 (${tool}): 文件已存在 (Skip Rules file (${tool}): File already exists)`))
        results.skipped++
      }
    }
    catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'Unknown error'
      console.error(chalk.red(`✗ 复制 Rules 文件失败 (${tool}) (Copy Rules file failed (${tool}))`), errorMessage)
      results.error++
      results.errors.push({ file: targetFile, error: errorMessage })
    }
  }

  /**
   * 递归转换 (Transform)
   */
  private async copyWithTransform(
    sourceDir: string,
    targetDir: string,
    results: MigrationStats,
    transform: (content: string, fileName: string) => string | Promise<string>,
  ): Promise<void> {
    try {
      const entries = await readdir(sourceDir, { withFileTypes: true })

      for (const entry of entries) {
        const sourcePath = join(sourceDir, entry.name)
        const targetPath = join(targetDir, entry.name)

        if (entry.isDirectory()) {
          await this.copyWithTransform(sourcePath, targetPath, results, transform)
        }
        else if (entry.isFile()) {
          if (await fileExists(targetPath) && !this.options.autoOverwrite) {
            results.skipped++
            continue
          }

          try {
            const content = await readFile(sourcePath, 'utf-8')
            const transformed = await transform(content, entry.name)
            await ensureDirectoryExists(dirname(targetPath))
            await writeFile(targetPath, transformed, 'utf-8')
            results.success++
          }
          catch (error) {
            results.error++
            results.errors.push({ file: entry.name, error: error instanceof Error
              ? error.message
              : '转换失败 (Conversion failed)' })
          }
        }
      }
    }
    catch (error) {
      results.error++
      results.errors.push({ file: sourceDir, error: error instanceof Error
        ? error.message
        : 'Unknown error' })
    }
  }

  /**
   * 递归转换 (MD -> MDC)
   */
  private async copyWithConversion(
    sourceDir: string,
    targetDir: string,
    results: MigrationStats,
  ): Promise<void> {
    try {
      const entries = await readdir(sourceDir, { withFileTypes: true })

      for (const entry of entries) {
        const sourcePath = join(sourceDir, entry.name)
        let targetPath = join(targetDir, entry.name)

        if (entry.isDirectory()) {
          await this.copyWithConversion(sourcePath, targetPath, results)
        }
        else if (entry.isFile()) {
          if (entry.name.endsWith('.md')) {
            targetPath = targetPath.replace(/\.md$/, '.mdc')

            if (await fileExists(targetPath) && !this.options.autoOverwrite) {
              results.skipped++
              continue
            }

            const success = await markdownToMdc(sourcePath, targetPath)
            if (success) {
              results.success++
            }
            else {
              results.error++
              results.errors.push({ file: entry.name, error: '转换失败 (Conversion failed)' })
            }
          }
          else {
            const result = await copyFileSafe(sourcePath, targetPath, this.options.autoOverwrite)
            if (result.success) {
              results.success++
            }
            else if (result.skipped) {
              results.skipped++
            }
            else {
              results.error++
              results.errors.push({ file: entry.name, error: result.error?.message || '复制失败 (Copy failed)' })
            }
          }
        }
      }
    }
    catch (error) {
      results.error++
      results.errors.push({ file: sourceDir, error: error instanceof Error
        ? error.message
        : 'Unknown error' })
    }
  }
}
