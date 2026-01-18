import type { MigrationError } from '../utils/logger'

/**
 * 迁移选项
 */
export interface MigrateOptions {
  isProject: boolean
  projectDir: string
  autoOverwrite: boolean
  sourceDir?: string
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
