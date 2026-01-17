/**
 * Skills 迁移器
 */

import { copyDirectory } from '../utils/file'
import { getToolPath } from '../path'
import type { CopyDirectoryResults } from '../utils/file'
import type { ToolKey } from '../config'
import type { MigrateOptions } from './commands'

/**
 * Skills 迁移器类
 */
export class SkillsMigrator {
  private sourceDir: string
  private targetTools: ToolKey[]
  private options: MigrateOptions

  constructor(sourceDir: string, targetTools: ToolKey[], options: MigrateOptions) {
    this.sourceDir = sourceDir
    this.targetTools = targetTools
    this.options = options
  }

  /**
   * 执行迁移
   */
  async migrate(): Promise<CopyDirectoryResults> {
    const results: CopyDirectoryResults = { success: 0, skipped: 0, error: 0, errors: [] }

    for (const tool of this.targetTools) {
      const targetDir = getToolPath(tool, 'skills', this.options.isProject, this.options.projectDir)
      const stats = await copyDirectory(this.sourceDir, targetDir, this.options.autoOverwrite)
      results.success += stats.success
      results.skipped += stats.skipped
      results.error += stats.error
      results.errors.push(...stats.errors)
    }

    return results
  }
}