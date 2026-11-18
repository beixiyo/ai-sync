import type { SkillsSyncConfig } from '../config'
import type { MigrationError } from '../utils/logger'

/**
 * 迁移选项
 */
export interface MigrateOptions {
  autoOverwrite: boolean
  sourceDir?: string
  /** Skills 源过滤策略；未配置时默认排除 synced */
  skills?: SkillsSyncConfig
  /** 1.x 的 Skills 源目录，仅用于跳过仍依赖它的旧链接 */
  legacySkillsDir?: string
}

/**
 * 复制/迁移结果统计
 */
export interface MigrationStats {
  success: number
  skipped: number
  error: number
  errors: MigrationError[]
}
