# IDE Rules 迁移脚本实现计划

## 背景

当前 `AI/IDERules/README.md` 提供了手动复制命令，需要将其改造为自动化迁移脚本，方便将配置规则迁移到不同的 AI IDE 工具。

## 参考设计

参考了 `Config/VSCode/migrate.cjs` 的设计模式：
- 使用 Node.js 原生 `util.parseArgs` 解析命令行参数
- 使用 `Config/fileUtils.cjs` 提供的工具函数
- 支持交互式选择和命令行参数两种方式
- 跨平台路径处理（Windows/macOS/Linux）
- 清晰的帮助信息和错误提示

## 实现方案

### 0. 依赖管理

使用 pnpm 管理依赖，确保转换的准确性和模块化：

```bash
# 初始化项目
pnpm init

# 安装依赖
pnpm add chalk inquirer ora toml yaml
```

**依赖说明**：
- `chalk`: 终端颜色输出
- `inquirer`: 交互式命令行界面（支持键盘选择）
- `ora`: 加载动画
- `toml`: TOML 解析和生成
- `yaml`: YAML frontmatter 解析

**package.json 配置**：
```json
{
  "name": "ide-rules-migrate",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "migrate": "node migrate.js"
  }
}
```

### 1. 支持的工具配置

根据 `AI/IDE-Config/Cli.md`，各工具的配置路径如下：

| 工具 | Commands | Skills | Rules | Hooks |
|------|----------|--------|-------|-------|
| **Cursor** | `~/.cursor/commands/` | `~/.cursor/skills/` | `~/.cursor/rules/` | `~/.cursor/hooks/` + `~/.cursor/hooks.json` |
| **Claude Code** | `~/.claude/commands/` | `~/.claude/skills/` | `~/.claude/CLAUDE.md` | `~/.claude/settings.json` |
| **OpenCode** | `~/.config/opencode/command/` | `~/.config/opencode/skill/` | `~/.config/opencode/AGENTS.md` | 插件系统（JS/TS） |
| **Gemini CLI** | `~/.gemini/commands/` | `~/.gemini/skills/` | `~/.gemini/GEMINI.md` | ❌ 不支持 |
| **IFlow CLI** | `~/.iflow/commands/` | `~/.iflow/skills/` | `~/.iflow/IFLOW.md` | ❌ 不支持 |

### 2. 配置可复用性分析

#### ✅ 完全可复用

| 配置类型 | 来源 | 可迁移到 |
|---------|------|---------|
| **Commands** | `.claude/commands/*` | Claude Code, OpenCode, Cursor（Markdown 格式） |
| **Skills** | `.claude/skills/*` | Claude Code, OpenCode, Cursor, Gemini, IFlow（部分兼容） |

#### ⚠️ 需要转换

| 配置类型 | 来源 | 可转换到 | 转换方式 |
|---------|------|---------|---------|
| **Commands** | `.claude/commands/*.md` | Gemini CLI, IFlow CLI | Markdown → TOML |

#### ⚠️ 需要转换

| 配置类型 | 来源 | 转换方式 |
|---------|------|---------|
| **Rules** | `.cursor/rules/*.mdc` | 合并为单个 `.md` 文件 → Claude/OpenCode/Gemini/IFlow |
| **Hooks** | `.cursor/hooks/*` + `.cursor/hooks.json` | 转换为 `settings.json` → Claude Code |

#### ❌ 不可复用

| 配置类型 | 原因 |
|---------|------|
| **Cursor Hooks** | 仅 Cursor 支持，其他工具需要不同实现 |
| **OpenCode Hooks** | 需要 JS/TS 插件，无法直接迁移 |

### 3. 核心功能设计

#### 3.1 交互式 CLI 设计

使用 `inquirer` 提供键盘导航的交互式选择体验：

```javascript
import inquirer from 'inquirer'
import chalk from 'chalk'

// 工具选择（多选）
const { tools } = await inquirer.prompt([
  {
    type: 'checkbox',
    name: 'tools',
    message: '选择要迁移到的工具（使用方向键导航，空格选择，回车确认）：',
    choices: [
      { name: '🎯 Cursor', value: 'cursor', checked: true },
      { name: '🤖 Claude Code', value: 'claude' },
      { name: '🚀 OpenCode', value: 'opencode' },
      { name: '💎 Gemini CLI', value: 'gemini' },
      { name: '⚡ IFlow CLI', value: 'iflow' }
    ]
  }
])

// 作用域选择（单选）
const { scope } = await inquirer.prompt([
  {
    type: 'list',
    name: 'scope',
    message: '选择配置作用域：',
    choices: [
      { name: '🌍 全局配置（~/.tool/）', value: 'global' },
      { name: '📁 项目配置（./.tool/）', value: 'project' }
    ]
  }
])

// 项目目录（如果选择项目）
let projectDir = process.cwd()
if (scope === 'project') {
  const { inputDir } = await inquirer.prompt([
    {
      type: 'input',
      name: 'inputDir',
      message: '输入项目目录路径：',
      default: process.cwd()
    }
  ])
  projectDir = inputDir
}

// 覆盖确认
const { overwrite } = await inquirer.prompt([
  {
    type: 'confirm',
    name: 'overwrite',
    message: '是否自动覆盖已存在的文件？',
    default: false
  }
])
```

#### 3.2 命令行参数（快捷方式）

```bash
pnpm migrate [options]

选项:
  -s, --source <dir>     源目录（默认：当前目录的 IDERules）
  -t, --target <tools>   目标工具，逗号分隔（如：cursor,claude,opencode）
  -p, --project          项目级配置
  -d, --project-dir <dir> 项目目录
  -y, --yes              自动覆盖
  -h, --help             显示帮助信息
  --interactive          强制交互模式（默认）
```

**使用场景**：
- 无参数：完全交互式选择
- 有参数：快速执行，跳过交互

#### 3.2 工具选择映射

```
1. cursor      - Cursor
2. claude      - Claude Code
3. opencode    - OpenCode
4. gemini      - Gemini CLI
5. iflow       - IFlow CLI
```

支持多选：`-t 1,2,3` 或 `-t cursor,claude,opencode`

#### 3.3 模块化架构

```
migrate.js                 # 主入口，CLI 交互
├── lib/
│   ├── config.js          # 工具配置定义
│   ├── path.js            # 路径处理（~ 展开、跨平台）
│   ├── migrators/
│   │   ├── base.js        # 基础迁移器
│   │   ├── commands.js    # Commands 迁移器
│   │   ├── skills.js      # Skills 迁移器
│   │   ├── rules.js       # Rules 迁移器
│   │   └── hooks.js       # Hooks 迁移器
│   ├── converters/
│   │   ├── markdown-to-toml.js  # Markdown → TOML
│   │   ├── rules-merger.js      # Rules 合并
│   │   └── hooks-converter.js   # Hooks 转换
│   └── utils/
│       ├── file.js        # 文件操作（复制、读取）
│       ├── logger.js      # 日志和进度显示
│       └── validator.js   # 验证工具
```

#### 3.4 配置迁移逻辑

```javascript
// 支持的配置类型
const CONFIG_TYPES = {
  commands: {
    source: '.claude/commands',
    // 直接复制（Markdown 格式）
    directCopy: {
      cursor: '~/.cursor/commands',
      claude: '~/.claude/commands',
      opencode: '~/.config/opencode/command'
    },
    // 需要转换（Markdown → TOML）
    convertToTOML: {
      gemini: '~/.gemini/commands',
      iflow: '~/.iflow/commands'
    }
  },
  skills: {
    source: '.claude/skills',
    targets: {
      cursor: '~/.cursor/skills',
      claude: '~/.claude/skills',
      opencode: '~/.config/opencode/skill',
      gemini: '~/.gemini/skills',
      iflow: '~/.iflow/skills'
    }
  },
  rules: {
    source: '.cursor/rules',
    targets: {
      cursor: '~/.cursor/rules',
      claude: '~/.claude/CLAUDE.md',  // 合并
      opencode: '~/.config/opencode/AGENTS.md',  // 合并
      gemini: '~/.gemini/GEMINI.md',  // 合并
      iflow: '~/.iflow/IFLOW.md'  // 合并
    }
  },
  hooks: {
    source: '.cursor/hooks',
    config: '.cursor/hooks.json',
    targets: {
      cursor: '~/.cursor/hooks',
      claude: '~/.claude/settings.json'  // 转换
    }
  }
}
```

### 4. 模块化实现

#### 4.1 路径处理模块

```javascript
// lib/path.js
import { homedir } from 'os'
import { join, resolve } from 'path'

export function expandHome(filepath) {
  if (filepath.startsWith('~')) {
    return join(homedir(), filepath.slice(1))
  }
  return filepath
}

export function getToolPath(tool, configType, isProject = false, projectDir = '') {
  const paths = {
    cursor: {
      global: '~/.cursor',
      project: '.cursor'
    },
    claude: {
      global: '~/.claude',
      project: '.claude'
    },
    opencode: {
      global: '~/.config/opencode',
      project: '.opencode'
    },
    gemini: {
      global: '~/.gemini',
      project: '.gemini'
    },
    iflow: {
      global: '~/.iflow',
      project: '.iflow'
    }
  }

  const basePath = isProject
    ? resolve(projectDir, paths[tool].project)
    : expandHome(paths[tool].global)

  return join(basePath, configType)
}
```

#### 4.2 Commands 迁移器

```javascript
// lib/migrators/commands.js
import { copyFile, copyDirectory } from '../utils/file.js'
import { convertMarkdownToTOML } from '../converters/markdown-to-toml.js'
import chalk from 'chalk'

export class CommandsMigrator {
  constructor(sourceDir, targetTools, options) {
    this.sourceDir = sourceDir
    this.targetTools = targetTools
    this.options = options
  }

  async migrate() {
    const results = { success: 0, skipped: 0, error: 0 }

    for (const tool of this.targetTools) {
      const targetDir = getToolPath(tool, 'commands', this.options.isProject, this.options.projectDir)

      // 直接复制的工具（Markdown 格式）
      if (['cursor', 'claude', 'opencode'].includes(tool)) {
        const stats = await copyDirectory(this.sourceDir, targetDir, this.options.autoOverwrite)
        results.success += stats.success
        results.skipped += stats.skip
        results.error += stats.error
      }
      // 需要转换的工具（TOML 格式）
      else if (['gemini', 'iflow'].includes(tool)) {
        await this.migrateWithConversion(targetDir, results)
      }
    }

    return results
  }

  async migrateWithConversion(targetDir, results) {
    const files = await getMarkdownFiles(this.sourceDir)

    for (const file of files) {
      const sourcePath = join(this.sourceDir, file)
      const targetPath = join(targetDir, file.replace('.md', '.toml'))

      try {
        await convertMarkdownToTOML(sourcePath, targetPath)
        console.log(chalk.green(`✓ 转换: ${file} → ${file.replace('.md', '.toml')}`))
        results.success++
      }
      catch (error) {
        console.error(chalk.red(`✗ 转换失败: ${file}`), error.message)
        results.error++
      }
    }
  }
}
```

#### 4.3 Markdown → TOML 转换器

```javascript
// lib/converters/markdown-to-toml.js
import YAML from 'yaml'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

export async function convertMarkdownToTOML(sourcePath, targetPath) {
  const content = await readFile(sourcePath, 'utf-8')

  // 解析 frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
  let frontmatter = {}
  let prompt = content

  if (frontmatterMatch) {
    try {
      frontmatter = YAML.parse(frontmatterMatch[1])
      prompt = content.replace(/^---[\s\S]*?---\n/, '')
    }
    catch (error) {
      // frontmatter 解析失败，跳过
    }
  }

  // 提取 description
  const description = frontmatter.description || ''

  // 转换参数语法
  prompt = convertParameterSyntax(prompt)

  // 移除不支持的配置
  prompt = removeUnsupportedConfig(prompt)

  // 生成 TOML
  const toml = generateTOML(description, prompt)

  await writeFile(targetPath, toml, 'utf-8')
}

function convertParameterSyntax(prompt) {
  // $ARGUMENTS → {{args}}
  prompt = prompt.replace(/\$ARGUMENTS/g, '{{args}}')

  // $1, $2, $3 → {{arg1}}, {{arg2}}, {{arg3}}
  prompt = prompt.replace(/\$(\d+)/g, '{{arg$1}}')

  // `command` → !{command}
  prompt = prompt.replace(/`([^`]+)`/g, '!{$1}')

  return prompt
}

function removeUnsupportedConfig(prompt) {
  // 移除 allowed-tools
  prompt = prompt.replace(/allowed-tools:.*\n/g, '')

  // 移除 argument-hint
  prompt = prompt.replace(/argument-hint:.*\n/g, '')

  // 移除 context
  prompt = prompt.replace(/context:.*\n/g, '')

  return prompt
}

function generateTOML(description, prompt) {
  let toml = `prompt = """\n${prompt.trim()}\n"""\n`

  if (description) {
    toml = `description = "${description}"\n${toml}`
  }

  return toml
}
```

#### 4.4 Rules 合并器

```javascript
// lib/converters/rules-merger.js
import { readFile, writeFile } from 'fs/promises'
import { readdir } from 'fs/promises'
import YAML from 'yaml'
import { join } from 'path'

export async function mergeRules(sourceDir, targetFile) {
  const files = await readdir(sourceDir)
  const mdcFiles = files
    .filter(f => f.endsWith('.mdc'))
    .sort()

  let content = '# IDE Rules\n\n'
  content += '> 本文件由 IDE Rules 迁移脚本自动生成\n'
  content += '> 源文件：' + mdcFiles.join(', ') + '\n\n'
  content += '---\n\n'

  for (const file of mdcFiles) {
    const filePath = join(sourceDir, file)
    const fileContent = await readFile(filePath, 'utf-8')

    // 提取 frontmatter
    const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---/)
    let frontmatter = {}
    let body = fileContent

    if (frontmatterMatch) {
      try {
        frontmatter = YAML.parse(frontmatterMatch[1])
        body = fileContent.replace(/^---[\s\S]*?---\n/, '')
      }
      catch (error) {
        // frontmatter 解析失败
      }
    }

    // 添加文件标题
    content += `## ${frontmatter.description || file.replace('.mdc', '')}\n\n`
    content += body
    content += '\n\n---\n\n'
  }

  await writeFile(targetFile, content, 'utf-8')
}
```

#### 4.5 Hooks 转换器

```javascript
// lib/converters/hooks-converter.js
import { readFile, writeFile } from 'fs/promises'

export async function convertHooksForClaude(sourceHooksDir, sourceConfigFile, targetFile) {
  // 读取 Cursor hooks.json
  const cursorHooks = JSON.parse(await readFile(sourceConfigFile, 'utf-8'))

  // 转换为 Claude Code 格式
  const claudeSettings = {}

  // afterFileEdit → PostToolUse
  if (cursorHooks.hooks?.afterFileEdit) {
    claudeSettings.PostToolUse = cursorHooks.hooks.afterFileEdit.map(hook => ({
      matcher: 'Write|Edit',
      hooks: [{
        type: 'command',
        command: hook.command.replace('~/.cursor/hooks', '${CLAUDE_PLUGIN_ROOT}/hooks'),
        timeout: 30
      }]
    }))
  }

  // beforeShellExecution → PreToolUse
  if (cursorHooks.hooks?.beforeShellExecution) {
    claudeSettings.PreToolUse = cursorHooks.hooks.beforeShellExecution.map(hook => ({
      matcher: 'Bash',
      hooks: [{
        type: 'command',
        command: hook.command,
        timeout: 30
      }]
    }))
  }

  // stop → Stop
  if (cursorHooks.hooks?.stop) {
    claudeSettings.Stop = cursorHooks.hooks.stop.map(hook => ({
      hooks: [{
        type: 'command',
        command: hook.command,
        timeout: 30
      }]
    }))
  }

  await writeFile(targetFile, JSON.stringify(claudeSettings, null, 2), 'utf-8')
}
```

#### 4.6 日志和进度显示

```javascript
// lib/utils/logger.js
import ora from 'ora'
import chalk from 'chalk'

export class Logger {
  constructor() {
    this.spinners = new Map()
  }

  start(message) {
    const spinner = ora(chalk.cyan(message)).start()
    this.spinners.set(message, spinner)
    return spinner
  }

  succeed(message) {
    const spinner = this.spinners.get(message)
    if (spinner) {
      spinner.succeed(chalk.green(message))
      this.spinners.delete(message)
    }
  }

  fail(message, error) {
    const spinner = this.spinners.get(message)
    if (spinner) {
      spinner.fail(chalk.red(message))
      this.spinners.delete(message)
    }
    if (error) {
      console.error(chalk.red(error))
    }
  }

  info(message) {
    console.log(chalk.blue(message))
  }

  warn(message) {
    console.log(chalk.yellow(message))
  }

  success(message) {
    console.log(chalk.green(message))
  }

  error(message) {
    console.log(chalk.red(message))
  }
}
```

### 5. 特殊处理逻辑

#### 5.1 Rules 合并

对于不支持 `.mdc` 多文件的工具，需要将所有 `.cursor/rules/*.mdc` 合并为单个 `.md` 文件：

```javascript
async function mergeRules(sourceDir, targetFile) {
  const files = await fs.promises.readdir(sourceDir)
  const mdcFiles = files.filter(f => f.endsWith('.mdc')).sort()

  let content = '# IDE Rules\n\n'
  for (const file of mdcFiles) {
    const filePath = path.join(sourceDir, file)
    const fileContent = await fs.promises.readFile(filePath, 'utf-8')
    content += `---\n${fileContent}\n\n---\n\n`
  }

  await fs.promises.writeFile(targetFile, content, 'utf-8')
}
```

#### 5.2 Commands 转换（Markdown → TOML）

将 Claude/Cursor/OpenCode 的 Markdown 格式命令转换为 Gemini/IFlow 的 TOML 格式：

```javascript
async function convertCommandToTOML(sourceFile, targetFile) {
  const content = await fs.promises.readFile(sourceFile, 'utf-8')

  // 解析 frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
  let description = ''
  let prompt = content

  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1]
    const descMatch = frontmatter.match(/description:\s*(.+)/)
    if (descMatch) {
      description = descMatch[1].trim().replace(/^["']|["']$/g, '')
    }
    prompt = content.replace(/^---[\s\S]*?---\n/, '')
  }

  // 转换 Claude 参数语法 $ARGUMENTS → {{args}}
  prompt = prompt.replace(/\$ARGUMENTS/g, '{{args}}')
  prompt = prompt.replace(/\$1/g, '{{arg1}}')
  prompt = prompt.replace(/\$2/g, '{{arg2}}')

  // 移除 allowed-tools 等不支持的配置
  prompt = prompt.replace(/allowed-tools:.*\n/g, '')
  prompt = prompt.replace(/argument-hint:.*\n/g, '')

  // 生成 TOML
  let toml = `prompt = """\n${prompt.trim()}\n"""\n`
  if (description) {
    toml = `description = "${description}"\n${toml}`
  }

  await fs.promises.writeFile(targetFile, toml, 'utf-8')
}
```

#### 5.3 Hooks 转换

将 Cursor Hooks 转换为 Claude Code 格式：

```javascript
async function convertHooksForClaude(sourceHooksDir, sourceConfigFile, targetFile) {
  // 读取 Cursor hooks.json
  const cursorHooks = JSON.parse(await fs.promises.readFile(sourceConfigFile, 'utf-8'))

  // 转换为 Claude Code 格式
  const claudeSettings = {
    PostToolUse: cursorHooks.hooks.afterFileEdit?.map(hook => ({
      matcher: 'Write|Edit',
      hooks: [{
        type: 'command',
        command: hook.command.replace('~/.cursor/hooks', '${CLAUDE_PLUGIN_ROOT}/hooks'),
        timeout: 30
      }]
    })) || []
  }

  await fs.promises.writeFile(targetFile, JSON.stringify(claudeSettings, null, 2), 'utf-8')
}
```

#### 5.4 Shell 脚本权限

在 Windows 上需要特殊处理 `.sh` 文件：

```javascript
async function setExecutablePermission(filePath) {
  if (process.platform !== 'win32') {
    await fs.promises.chmod(filePath, 0o755)
  }
}
```

### 6. 项目级配置支持

```javascript
function getTargetPath(tool, configType, isProject, projectDir) {
  const basePaths = {
    cursor: {
      global: '~/.cursor',
      project: '.cursor'
    },
    claude: {
      global: '~/.claude',
      project: '.claude'
    },
    // ...
  }

  const basePath = isProject
    ? path.join(projectDir, basePaths[tool].project)
    : expandHome(basePaths[tool].global)

  return path.join(basePath, configType)
}
```

### 7. 配置格式对比

| 特性 | Claude/Cursor/OpenCode | Gemini/IFlow |
|------|------------------------|--------------|
| 文件格式 | Markdown (.md) | TOML (.toml) |
| 参数语法 | `$ARGUMENTS`, `$1`, `$2` | `{{args}}` |
| Shell 执行 | `!`command`` | `!{command}` |
| 文件引用 | `@filename` | `@{filepath}` |
| Frontmatter | 支持 | 不支持 |

### 8. 错误处理与验证

- 检查源目录是否存在
- 检查目标工具配置目录是否存在（项目模式除外）
- 验证工具是否支持该配置类型
- 提供详细的错误提示和跳过选项

### 9. 输出统计

```
--- 迁移完成 ---
工具: Cursor, Claude Code
成功: 15
跳过: 3
错误: 0
```

## 实现步骤

1. ✅ 分析现有配置结构和工具支持情况
2. ✅ 设计命令行参数和工具映射
3. ✅ 设计模块化架构
4. ✅ 设计交互式 CLI 体验
5. ✅ 初始化项目并安装依赖
6. ✅ 实现路径处理模块
7. ✅ 实现 Commands 迁移器和转换器
8. ✅ 实现 Skills 迁移器
9. ✅ 实现 Rules 合并器
10. ✅ 实现 Hooks 转换器
11. ✅ 实现日志和进度显示
12. ✅ 实现主入口和 CLI 交互
13. ✅ 测试各工具的迁移结果

1. ✅ 分析现有配置结构和工具支持情况
2. ✅ 设计命令行参数和工具映射
3. ✅ 实现核心迁移逻辑（复制、合并、转换）
4. ✅ 实现交互式选择和批量处理
5. ✅ 添加错误处理和统计输出
6. ✅ 编写帮助文档和使用示例
7. ✅ 编写迁移脚本
8. ✅ 测试各工具的迁移结果

## 使用示例

### 交互式模式（推荐）

```bash
pnpm migrate
```

**体验**：
- 使用方向键导航
- 空格键选择/取消选择
- 回车键确认
- 实时显示加载进度

### 快捷方式

```bash
# 迁移到单个工具
pnpm migrate -t cursor

# 迁移到多个工具
pnpm migrate -t cursor,claude,opencode

# 项目级配置
pnpm migrate -p -d /path/to/project

# 自动覆盖
pnpm migrate -y

# 指定源目录
pnpm migrate -s /path/to/IDERules
```

### 输出示例

```
? 选择要迁移到的工具（使用方向键导航，空格选择，回车确认）：
 ◯ 🎯 Cursor
 ⬤ 🤖 Claude Code
 ⬤ 🚀 OpenCode
 ◯ 💎 Gemini CLI
 ◯ ⚡ IFlow CLI

? 选择配置作用域：
  🌍 全局配置（~/.tool/）
❯ 📁 项目配置（./.tool/）

? 是否自动覆盖已存在的文件？ (y/N)

✓ 迁移 Commands... (2/2)
✓ 迁移 Skills... (1/1)
✓ 迁移 Rules... (1/1)
✓ 迁移 Hooks... (1/1)

--- 迁移完成 ---
工具: Claude Code, OpenCode
成功: 15
跳过: 3
错误: 0
```

## 注意事项

1. **Commands 格式差异**：
   - Claude/Cursor/OpenCode 使用 Markdown 格式
   - Gemini/IFlow 使用 TOML 格式，需要转换
   - 参数语法不同：`$ARGUMENTS` → `{{args}}`
   - Shell 执行语法不同：`` `command` `` → `!{command}`
   - 文件引用语法不同：`@file` → `@{filepath}`

2. **Skills 兼容性**：OpenCode 对 Claude Skills 的兼容性有限，某些高级字段会被忽略

3. **Hooks 差异**：Cursor Hooks 和 Claude Code Hooks 格式不同，需要转换

4. **Rules 格式**：Cursor 使用 `.mdc` 多文件，其他工具使用单个 `.md` 文件

5. **路径处理**：需要正确处理 `~` 展开和跨平台路径分隔符

6. **权限问题**：Shell 脚本需要执行权限（Windows 除外）