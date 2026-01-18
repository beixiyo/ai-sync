/**
 * 日志工具类 (Logger Utility Class)
 */

import ora from 'ora'
import chalk from 'chalk'
import type { Ora } from 'ora'

/**
 * 日志工具类 (Logger Utility Class)
 */
export class Logger {
  private spinners: Map<string, Ora>

  constructor() {
    this.spinners = new Map()
  }

  /**
   * 开始加载动画 (Start loading animation)
   */
  start(message: string): Ora {
    return ora(chalk.cyan(message)).start()
  }

  /**
   * 信息 (Info)
   */
  info(message: string): void {
    console.log(chalk.blue(message))
  }

  /**
   * 警告 (Warn)
   */
  warn(message: string): void {
    console.log(chalk.yellow(message))
  }

  /**
   * 成功消息 (Success message)
   */
  success(message: string): void {
    console.log(chalk.green(message))
  }

  /**
   * 错误消息 (Error message)
   */
  error(message: string): void {
    console.log(chalk.red(message))
  }

  /**
   * 分节标题 (Section title)
   */
  section(title: string): void {
    console.log('')
    console.log(chalk.bold.cyan(`--- ${title} ---`))
    console.log('')
  }

  /**
   * 汇总结果 (Summary results)
   */
  summary(results: MigrationResults): void {
    console.log('')
    console.log(chalk.bold.green('--- 迁移完成 (Migration Complete) ---'))
    console.log(`工具 (Tools): ${results.tools.join(', ')}`)
    console.log(`成功 (Success): ${results.success}`)
    console.log(`跳过 (Skipped): ${results.skipped}`)
    console.log(`错误 (Errors): ${results.error}`)
    if (results.errors.length > 0) {
      console.log('')
      console.log(chalk.red('错误详情 (Error details):'))
      results.errors.forEach((err) => {
        console.log(chalk.red(`  - ${err.file}: ${err.error}`))
      })
    }
    console.log('')
  }
}

export interface MigrationError {
  file: string
  error: string
}

export interface MigrationResults {
  success: number
  skipped: number
  error: number
  errors: MigrationError[]
  tools: string[]
}