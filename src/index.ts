#!/usr/bin/env node

/**
 * IDE Rules 迁移脚本主入口
 * 支持将 Claude/Cursor 的配置迁移到其他 AI 工具
 */

import { parseArgs } from 'util'
import inquirer from 'inquirer'
import chalk from 'chalk'
import { resolve } from 'path'
import { CommandsMigrator } from './lib/migrators/commands'
import { SkillsMigrator } from './lib/migrators/skills'
import { RulesMigrator } from './lib/migrators/rules'
import { HooksMigrator } from './lib/migrators/hooks'
import { getToolChoiceList, getScopeChoiceList, isConfigTypeSupported, TOOL_CONFIGS } from './lib/config'
import { Logger } from './lib/utils/logger'
import { directoryExists } from './lib/utils/file'
import type { ConfigType, ToolKey } from './lib/config'
import type { MigrateOptions } from './lib/migrators/commands'
import type { MigrationResults } from './lib/utils/logger'

/**
 * 打印帮助信息
 */
function printHelp(): void {
  console.log(chalk.cyan('IDE Rules 迁移脚本\n'))
  console.log('用法: pnpm migrate [options]\n')
  console.log('选项:')
  console.log('  -s, --source <dir>     源目录（默认：当前目录的 IDERules）')
  console.log('  -t, --target <tools>   目标工具，逗号分隔（如：cursor,claude,opencode）')
  console.log('  -p, --project          项目级配置')
  console.log('  -d, --project-dir <dir> 项目目录')
  console.log('  -y, --yes              自动覆盖')
  console.log('  -h, --help             显示帮助信息')
  console.log('  --interactive          强制交互模式（默认）\n')
  console.log('支持的工具:')
  console.log('  cursor      - Cursor')
  console.log('  claude      - Claude Code')
  console.log('  opencode    - OpenCode')
  console.log('  gemini      - Gemini CLI')
  console.log('  iflow       - IFlow CLI\n')
  console.log('示例:')
  console.log('  pnpm migrate                    # 交互式模式')
  console.log('  pnpm migrate -t cursor          # 迁移到 Cursor')
  console.log('  pnpm migrate -t cursor,claude   # 迁移到多个工具')
  console.log('  pnpm migrate -p -d /path/to/project  # 项目级配置')
}

/**
 * 交互式模式
 */
async function interactiveMode(): Promise<MigrateOptions & { sourceDir?: string; tools: ToolKey[] }> {
  const logger = new Logger()

  logger.section('IDE Rules 迁移向导')

  const { tools } = await inquirer.prompt<InteractiveAnswers>([
    {
      type: 'checkbox',
      name: 'tools',
      message: '选择要迁移到的工具（使用方向键导航，空格选择，回车确认）：',
      choices: getToolChoiceList()
    }
  ])

  if (tools.length === 0) {
    console.log(chalk.yellow('未选择任何工具，退出。'))
    process.exit(0)
  }

  const { isProject } = await inquirer.prompt<InteractiveAnswers>([
    {
      type: 'confirm',
      name: 'isProject',
      message: '配置到当前项目（否则为全局配置）？',
      default: false
    }
  ])

  let projectDir = process.cwd()
  if (isProject) {
    const { inputDir } = await inquirer.prompt<InteractiveAnswers>([
      {
        type: 'input',
        name: 'inputDir',
        message: '输入项目目录路径：',
        default: process.cwd()
      }
    ])
    projectDir = resolve(inputDir!)
  }

  const { overwrite } = await inquirer.prompt<InteractiveAnswers>([
    {
      type: 'confirm',
      name: 'overwrite',
      message: '是否自动覆盖已存在的文件？',
      default: false
    }
  ])

  return {
    tools,
    isProject,
    projectDir,
    autoOverwrite: overwrite
  }
}

/**
 * 解析命令行参数
 */
async function parseCommandLineArgs(): Promise<CommandLineOptions | null> {
  const { values, positionals } = parseArgs({
    options: {
      source: { type: 'string', short: 's' },
      target: { type: 'string', short: 't' },
      project: { type: 'boolean', short: 'p' },
      'project-dir': { type: 'string', short: 'd' },
      yes: { type: 'boolean', short: 'y' },
      help: { type: 'boolean', short: 'h' },
      interactive: { type: 'boolean' }
    },
    allowPositionals: true
  })

  if (values.help) {
    printHelp()
    process.exit(0)
  }

  if (values.interactive || (!values.target && !values.source)) {
    return null
  }

  let tools: ToolKey[] = []
  if (values.target) {
    tools = values.target.split(',').map(t => t.trim().toLowerCase()) as ToolKey[]
  }

  const isProject = values.project || false
  const projectDir = values['project-dir'] ? resolve(values['project-dir']) : process.cwd()
  const autoOverwrite = values.yes || false
  const sourceDir = values.source ? resolve(values.source) : process.cwd()

  return {
    tools,
    isProject,
    projectDir,
    autoOverwrite,
    sourceDir
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const logger = new Logger()

  let options = await parseCommandLineArgs()

  if (options === null) {
    options = (await interactiveMode()) as CommandLineOptions
  }

  const sourceDir = options.sourceDir || process.cwd()

  if (!(await directoryExists(sourceDir))) {
    console.error(chalk.red(`源目录不存在: ${sourceDir}`))
    process.exit(1)
  }

  logger.section('开始迁移')
  console.log(chalk.cyan(`源目录: ${sourceDir}`))
  console.log(chalk.cyan(`目标工具: ${options.tools.map(t => TOOL_CONFIGS[t]?.name || t).join(', ')}`))
  console.log(chalk.cyan(`作用域: ${options.isProject ? `项目 (${options.projectDir})` : '全局'}`))
  console.log(chalk.cyan(`自动覆盖: ${options.autoOverwrite ? '是' : '否'}`))
  console.log('')

  const results: MigrationResults = {
    success: 0,
    skipped: 0,
    error: 0,
    errors: [],
    tools: options.tools.map(t => TOOL_CONFIGS[t]?.name || t)
  }

  const configTypes: ConfigType[] = ['commands', 'skills', 'rules', 'hooks']

  for (const configType of configTypes) {
    const supportedTools = options.tools.filter(t => isConfigTypeSupported(t, configType))

    if (supportedTools.length === 0) {
      continue
    }

    const spinner = logger.start(`迁移 ${configType}...`)

    try {
      let migrator: CommandsMigrator | SkillsMigrator | RulesMigrator | HooksMigrator
      const sourcePaths: SourcePaths = {
        commands: resolve(sourceDir, '.claude/commands'),
        skills: resolve(sourceDir, '.claude/skills'),
        rules: resolve(sourceDir, '.cursor/rules'),
        hooks: {
          dir: resolve(sourceDir, '.cursor/hooks'),
          config: resolve(sourceDir, '.cursor/hooks.json')
        }
      }

      switch (configType) {
        case 'commands':
          migrator = new CommandsMigrator(sourcePaths.commands, supportedTools, options)
          break
        case 'skills':
          migrator = new SkillsMigrator(sourcePaths.skills, supportedTools, options)
          break
        case 'rules':
          migrator = new RulesMigrator(sourcePaths.rules, supportedTools, options)
          break
        case 'hooks':
          migrator = new HooksMigrator(
            sourcePaths.hooks.dir,
            sourcePaths.hooks.config,
            supportedTools,
            options
          )
          break
      }

      const typeResults = await migrator.migrate()
      results.success += typeResults.success
      results.skipped += typeResults.skipped
      results.error += typeResults.error
      results.errors.push(...typeResults.errors)

      spinner.succeed(`迁移 ${configType}...`)
    } catch (error) {
      spinner.fail(`迁移 ${configType}...`)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(chalk.red(errorMessage))
      results.error++
      results.errors.push({ file: configType, error: errorMessage })
    }
  }

  logger.summary(results)
}

main().catch((error) => {
  console.error(chalk.red('迁移失败:'), error)
  process.exit(1)
})

// 类型定义
/**
 * 命令行选项
 */
interface CommandLineOptions {
  tools: ToolKey[]
  isProject: boolean
  projectDir: string
  autoOverwrite: boolean
  sourceDir: string
}

/**
 * 交互式答案
 */
interface InteractiveAnswers {
  tools: ToolKey[]
  isProject: boolean
  inputDir?: string
  overwrite: boolean
}

/**
 * 源路径配置
 */
interface SourcePaths {
  commands: string
  skills: string
  rules: string
  hooks: {
    dir: string
    config: string
  }
}