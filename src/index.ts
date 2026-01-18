#!/usr/bin/env node

/**
 * IDE Rules 迁移脚本主入口
 * 支持将 Claude/Cursor 的配置迁移到其他 AI 工具
 */

import type { ConfigType, ToolConfig, ToolKey } from './lib/config'
import type { BaseMigrator } from './lib/migrators/base'
import type { MigrateOptions } from './lib/migrators/types'
import type { MigrationResults } from './lib/utils/logger'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { getToolChoiceList, INTERNAL_CONFIG, isConfigTypeSupported } from './lib/config'
import { loadUserConfig, mergeConfigs } from './lib/customConfig'
import { CommandsMigrator } from './lib/migrators/commands'
import { MCPMigrator } from './lib/migrators/mcp'
import { RulesMigrator } from './lib/migrators/rules'
import { SkillsMigrator } from './lib/migrators/skills'
import {
  expandHome,
  getCommandsSourcePath,
  getMCPSourcePath,
  getRuleSourcePath,
  getSkillsSourcePath,
  resolveSourceDir,
} from './lib/path'
import { Logger } from './lib/utils/logger'

/**
 * 打印帮助信息
 */
function printHelp(): void {
  console.log(chalk.cyan('AI Config 迁移脚本 (AI Config Migration)\n'))
  console.log('用法 (Usage): pnpm migrate [options]\n')
  console.log('选项 (Options):')
  console.log('  -s, --source <dir>     源目录 (Source directory)（默认：~）')
  console.log('  -t, --target <tools>   目标工具 (Target tools)，逗号分隔（如：cursor,claude,opencode）')
  console.log('  -c, --config <path>    指定配置文件 (Specify config file)')
  console.log('  -p, --project          配置目录为项目级 (Config directory is project-level)')
  console.log('  -d, --project-dir <dir> 配置目录路径 (Config directory path)')
  console.log('  -y, --yes              自动覆盖 (Auto overwrite)')
  console.log('  -h, --help             显示帮助信息 (Show help)')
  console.log('  --interactive          强制交互模式 (Force interactive mode)（默认）\n')
  console.log('支持的工具 (Supported tools):')
  console.log('  cursor      - Cursor')
  console.log('  claude      - Claude Code')
  console.log('  opencode    - OpenCode')
  console.log('  gemini      - Gemini CLI')
  console.log('  iflow       - IFlow CLI')
  console.log('  codex       - Codex\n')
  console.log('示例 (Examples):')
  console.log('  pnpm migrate                    # 交互式模式 (Interactive mode)')
  console.log('  pnpm migrate -t cursor          # 迁移到 Cursor (Migrate to Cursor)')
  console.log('  pnpm migrate -t cursor,claude   # 迁移到多个工具 (Migrate to multiple tools)')
  console.log('  pnpm migrate -p -d /path/to/project  # 项目级配置 (Project-level configuration)')
}

/**
 * 交互式模式
 */
async function interactiveMode(tools: Record<ToolKey, ToolConfig> = INTERNAL_CONFIG.tools as Record<ToolKey, ToolConfig>): Promise<MigrateOptions & { sourceDir?: string, tools: ToolKey[] }> {
  const logger = new Logger()

  logger.section('IDE Rules 迁移向导 (IDE Rules Migration Wizard)')

  const { sourceDir } = await inquirer.prompt<InteractiveAnswers>([
    {
      type: 'input',
      name: 'sourceDir',
      message: '源配置目录 (Source Directory):',
      default: '~',
    },
  ])

  const { tools: selectedTools } = await inquirer.prompt<InteractiveAnswers>([
    {
      type: 'checkbox',
      name: 'tools',
      message: '目标工具 (Target Tools):',
      choices: getToolChoiceList(tools),
    },
  ])

  if (selectedTools.length === 0) {
    console.log(chalk.yellow('未选择任何工具，退出。(No tools selected, exiting.)'))
    process.exit(0)
  }

  const { isGlobal } = await inquirer.prompt<InteractiveAnswers>([
    {
      type: 'confirm',
      name: 'isGlobal',
      message: '安装到全局目录？(Install to global directory?)',
      default: true,
    },
  ])

  const isProject = !isGlobal
  let projectDir = process.cwd()
  if (isProject) {
    const { inputDir } = await inquirer.prompt<InteractiveAnswers>([
      {
        type: 'input',
        name: 'inputDir',
        message: '项目路径 (Project Path):',
        default: process.cwd(),
      },
    ])
    projectDir = resolve(inputDir!)
  }

  const { overwrite } = await inquirer.prompt<InteractiveAnswers>([
    {
      type: 'confirm',
      name: 'overwrite',
      message: '覆盖已有文件？(Overwrite existing files?)',
      default: true,
    },
  ])

  return {
    tools: selectedTools,
    isProject,
    projectDir,
    autoOverwrite: overwrite,
    sourceDir,
  }
}

/**
 * 解析命令行参数
 */
async function parseCommandLineArgs(): Promise<CommandLineOptions | null> {
  const { values, positionals } = parseArgs({
    options: {
      'source': { type: 'string', short: 's' },
      'target': { type: 'string', short: 't' },
      'config': { type: 'string', short: 'c' },
      'project': { type: 'boolean', short: 'p' },
      'project-dir': { type: 'string', short: 'd' },
      'yes': { type: 'boolean', short: 'y' },
      'help': { type: 'boolean', short: 'h' },
      'interactive': { type: 'boolean' },
    },
    allowPositionals: true,
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
    /** 处理空格或逗号分隔的工具列表 */
    tools = values.target.split(/[\s,]+/).filter(t => t).map(t => t.trim().toLowerCase()) as ToolKey[]
  }

  const isProject = values.project || false
  const projectDir = values['project-dir']
    ? resolve(values['project-dir'])
    : process.cwd()
  const autoOverwrite = values.yes || false
  const sourceDir = values.source
    ? resolve(expandHome(values.source))
    : undefined
  const config = values.config

  return {
    tools,
    isProject,
    projectDir,
    autoOverwrite,
    sourceDir,
    config,
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const logger = new Logger()

  let options = await parseCommandLineArgs()

  /** 加载用户配置 */
  const userConfig = await loadUserConfig(process.cwd(), options?.config)

  /** 合并配置 */
  const mergedConfigs = mergeConfigs(INTERNAL_CONFIG, userConfig)
  const toolsConfig = mergedConfigs.tools as Record<ToolKey, ToolConfig>

  if (options === null) {
    options = (await interactiveMode(toolsConfig)) as CommandLineOptions
  }

  /** 探测源目录 */
  let sourceDir: string
  try {
    const defaultConfigDir = userConfig.global?.defaultConfigDir || expandHome('~/.claude')
    sourceDir = await resolveSourceDir(options.sourceDir, defaultConfigDir)
  }
  catch (error) {
    console.error(chalk.red(error instanceof Error
      ? error.message
      : 'Unknown path error'))
    process.exit(1)
  }

  logger.section('开始迁移 (Start Migration)')
  console.log(chalk.cyan(`源目录 (Source directory): ${sourceDir}`))
  console.log(chalk.cyan(`目标工具 (Target tools): ${options.tools.map(t => mergedConfigs.tools?.[t]?.name || t).join(', ')}`))
  console.log(chalk.cyan(`配置目录 (Config directory): ${options.isProject
    ? `项目 (${options.projectDir})`
    : '全局 (Global)'}`))
  console.log(chalk.cyan(`自动覆盖 (Auto overwrite): ${options.autoOverwrite
    ? '是 (Yes)'
    : '否 (No)'}`))
  console.log('')

  const results: MigrationResults = {
    success: 0,
    skipped: 0,
    error: 0,
    errors: [],
    tools: options.tools.map(t => mergedConfigs.tools?.[t]?.name || t),
  }

  const configTypes: ConfigType[] = ['commands', 'skills', 'rules', 'mcp']

  for (const configType of configTypes) {
    const supportedTools = options.tools.filter(supportedTool => isConfigTypeSupported(supportedTool, configType, toolsConfig))

    if (supportedTools.length === 0) {
      continue
    }

    const spinner = logger.start(`迁移 ${configType}... (Migrating ${configType}...)`)

    try {
      let migrator: BaseMigrator

      switch (configType) {
        case 'rules': {
          const ruleSourcePath = await getRuleSourcePath(sourceDir)
          migrator = new RulesMigrator(ruleSourcePath, supportedTools, options, toolsConfig)
          break
        }
        case 'commands': {
          const commandsPath = await getCommandsSourcePath(sourceDir)
          migrator = new CommandsMigrator(commandsPath, supportedTools, options, toolsConfig)
          break
        }
        case 'skills': {
          const skillsPath = await getSkillsSourcePath(sourceDir)
          migrator = new SkillsMigrator(skillsPath, supportedTools, options, toolsConfig)
          break
        }
        case 'mcp': {
          const mcpPath = await getMCPSourcePath(sourceDir)
          migrator = new MCPMigrator(mcpPath, supportedTools, options, toolsConfig)
          break
        }
        default:
          throw new Error(`不支持的配置类型 (Unsupported config type): ${configType}`)
      }

      const typeResults = await migrator.migrate()
      results.success += typeResults.success
      results.skipped += typeResults.skipped
      results.error += typeResults.error
      results.errors.push(...typeResults.errors)

      spinner.succeed(chalk.green(`迁移 ${configType} 完成 (Migrated ${configType} successfully)`))
    }
    catch (error) {
      spinner.fail(chalk.red(`迁移 ${configType} 失败 (Failed to migrate ${configType})`))
      const errorMessage = error instanceof Error
        ? error.message
        : 'Unknown error'
      console.error(chalk.red(errorMessage))
      results.error++
      results.errors.push({ file: configType, error: errorMessage })
    }
  }

  logger.summary(results)
}

main().catch((error) => {
  console.error(chalk.red('迁移失败 (Migration failed):'), error)
  process.exit(1)
})

/** 类型定义 */
/**
 * 命令行选项
 */
interface CommandLineOptions {
  tools: ToolKey[]
  isProject: boolean
  projectDir: string
  autoOverwrite: boolean
  sourceDir: string | undefined
  config?: string
}

/**
 * 交互式答案
 */
interface InteractiveAnswers {
  tools: ToolKey[]
  isProject: boolean
  isGlobal: boolean
  inputDir?: string
  overwrite: boolean
  sourceDir?: string
}
