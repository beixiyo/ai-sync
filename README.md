# IDE Rules 迁移脚本

自动化将 IDE 配置规则（Commands、Skills、Rules、Hooks）迁移到不同的 AI IDE 工具。

## 支持的工具

- 🎯 **Cursor** - 完全支持
- 🤖 **Claude Code** - 完全支持
- 🚀 **OpenCode** - 支持 Commands、Skills、Rules
- 💎 **Gemini CLI** - 支持 Commands（需转换）、Skills、Rules
- ⚡ **IFlow CLI** - 支持 Commands（需转换）、Skills、Rules

## 功能特性

- ✅ **交互式选择** - 使用方向键导航，空格选择
- ✅ **命令行参数** - 支持快速执行
- ✅ **格式转换** - Markdown ↔ TOML 自动转换
- ✅ **Rules 合并** - 多个 `.mdc` 文件合并为单个 `.md`
- ✅ **Hooks 转换** - Cursor Hooks ↔ Claude Code Hooks
- ✅ **全局/项目配置** - 支持全局和项目级配置
- ✅ **跨平台** - Windows/macOS/Linux

## 安装

```bash
cd AI/IDERules
pnpm install
```

## 使用方法

### 交互式模式（推荐）

```bash
pnpm migrate
```

### 命令行模式

```bash
# 迁移到单个工具
pnpm migrate -t cursor

# 迁移到多个工具（用引号包裹）
pnpm migrate -t "cursor,claude,opencode"

# 项目级配置
pnpm migrate -t claude -p -d /path/to/project

# 自动覆盖
pnpm migrate -t cursor -y

# 指定源目录
pnpm migrate -s /path/to/IDERules -t cursor

# 显示帮助
pnpm migrate --help
```

## 命令行参数

| 参数 | 简写 | 说明 |
|------|------|------|
| `--source <dir>` | `-s` | 源目录（默认：当前目录） |
| `--target <tools>` | `-t` | 目标工具，逗号分隔 |
| `--project` | `-p` | 项目级配置 |
| `--project-dir <dir>` | `-d` | 项目目录 |
| `--yes` | `-y` | 自动覆盖 |
| `--help` | `-h` | 显示帮助信息 |
| `--interactive` | | 强制交互模式 |

## 配置类型

| 配置类型 | 说明 | 转换需求 |
|---------|------|---------|
| **Commands** | 自定义命令 | Markdown → TOML（Gemini/IFlow） |
| **Skills** | 技能模块 | 直接复制 |
| **Rules** | IDE 规则 | 多文件合并 |
| **Hooks** | 钩子脚本 | 格式转换（Cursor → Claude） |

## 项目结构

```
AI/IDERules/
├── migrate.js              # 主入口
├── package.json
├── lib/
│   ├── config.js           # 工具配置定义
│   ├── path.js             # 路径处理
│   ├── migrators/          # 迁移器
│   │   ├── commands.js
│   │   ├── skills.js
│   │   ├── rules.js
│   │   └── hooks.js
│   ├── converters/         # 转换器
│   │   ├── markdown-to-toml.js
│   │   ├── rules-merger.js
│   │   └── hooks-converter.js
│   └── utils/              # 工具函数
│       ├── file.js
│       └── logger.js
├── .claude/                # Claude 源配置
│   ├── commands/
│   └── skills/
└── .cursor/                # Cursor 源配置
    ├── rules/
    ├── hooks/
    └── hooks.json
```

## 示例输出

```
--- 开始迁移 ---

源目录: C:\Code\note\AI\IDERules
目标工具: Claude Code
作用域: 全局
自动覆盖: 是

✓ 合并 Rules → claude
✓ 转换 Hooks → claude

--- 迁移完成 ---
工具: Claude Code
成功: 8
跳过: 0
错误: 0
```

## 注意事项

1. **Commands 格式差异**：
   - Claude/Cursor/OpenCode 使用 Markdown 格式
   - Gemini/IFlow 使用 TOML 格式，需要转换
   - 参数语法：`$ARGUMENTS` → `{{args}}`
   - Shell 执行：`` `command` `` → `!{command}`

2. **Rules 格式**：
   - Cursor 使用 `.mdc` 多文件
   - 其他工具使用单个 `.md` 文件

3. **Hooks 差异**：
   - Cursor Hooks 和 Claude Code Hooks 格式不同
   - 需要转换 `hooks.json` 配置

4. **路径处理**：
   - 自动处理 `~` 展开
   - 支持跨平台路径分隔符

## 许可证

ISC