/**
 * 日志工具类
 */

import ora from 'ora'
import chalk from 'chalk'
import type { Ora } from 'ora'

/**
 * 日志工具类
 */
export class Logger {
  private spinners: Map<string, Ora>

  constructor() {
    this.spinners = new Map()
  }

  /**
   * 开始加载动画
   */
  start(message: string): Ora {
    const spinner = ora(chalk.cyan(message)).start()
    this.spinners.set(message, spinner)
    return spinner
  }

  /**
   * 成功
   */
  succeed(message: string): void {
    const spinner = this.spinners.get(message)
    if (spinner) {
      spinner.succeed(chalk.green(message))
      this.spinners.delete(message)
    }
  }

  /**
   * 失败
   */
  fail(message: string, error?: string | Error): void {
    const spinner = this.spinners.get(message)
    if (spinner) {
      spinner.fail(chalk.red(message))
      this.spinners.delete(message)
    }
    if (error) {
      const errorMessage = error instanceof Error ? error.message : error
      console.error(chalk.red(errorMessage))
    }
  }

  /**
   * 信息
   */
  info(message: string): void {
    console.log(chalk.blue(message))
  }

  /**
   * 警告
   */
  warn(message: string): void {
    console.log(chalk.yellow(message))
  }

  /**
   * 成功消息
   */
  success(message: string): void {
    console.log(chalk.green(message))
  }

  /**
   * 错误消息
   */
  error(message: string): void {
    console.log(chalk.red(message))
  }

  /**
   * 分节标题
   */
  section(title: string): void {
    console.log('')
    console.log(chalk.bold.cyan(`--- ${title} ---`))
    console.log('')
  }

  /**
   * 汇总结果
   */
  summary(results: MigrationResults): void {
    console.log('')
    console.log(chalk.bold.green('--- 迁移完成 ---'))
    console.log(`工具: ${results.tools.join(', ')}`)
    console.log(`成功: ${results.success}`)
    console.log(`跳过: ${results.skipped}`)
    console.log(`错误: ${results.error}`)
    if (results.errors.length > 0) {
      console.log('')
      console.log(chalk.red('错误详情:'))
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