# AI 工具配置迁移

<div align="center">
  <img alt="npm-version" src="https://img.shields.io/npm/v/@jl-org/ai-sync?color=red&logo=npm" />
  <img alt="npm-download" src="https://img.shields.io/npm/dm/@jl-org/ai-sync?logo=npm" />
  <img alt="License" src="https://img.shields.io/npm/l/@jl-org/ai-sync?color=blue" />
  <img alt="typescript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" />
  <img alt="node.js" src="https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white" />
  <img alt="vitest" src="https://img.shields.io/badge/Vitest-646CFF?logo=vitest&logoColor=white" />
  <img alt="tsup" src="https://img.shields.io/badge/tsup-161B22?logo=tsup&logoColor=white" />
</div>

<div align="center">
  <a href="./README.md">中文</a>
  <span>|</span>
  <a href="./README.en.md">English</a>
</div>

自动化将 Claude 配置迁移到不同 AI IDE 工具的脚本

## 支持的工具

- Cursor
- Claude Code
- OpenCode
- CodeX
- Gemini CLI
- IFlow CLI

## 快速开始

### 1. 准备配置

**遵循 Claude Code 配置规范** https://code.claude.com/docs/zh-CN/settings

创建 `~/.claude` 目录，包含以下子目录：
- `~/.claude/commands/` - 存放自定义命令（Markdown 格式）
- `~/.claude/skills/` - 存放技能模块（Markdown 格式）
- `~/.claude/CLAUDE.md` | `.cursor/rules/*.mdc` - 存放 IDE 规则
  > 如果有 `AGENTS.md`, `AGENT.md`, `CLAUDE.md` 则优先当作 rules 同步，最后才是 `.cursor/rules`，按照指定优先级排序
- `~/.claude.json` - MCP 配置文件

### 2. 快速开始

```bash
npm i -g @jl-org/ai-sync

# 交互式执行
ai-sync
# 查看帮助
ai-sync --help
```

```bash
? 选择要迁移到的工具（使用方向键导航，空格选择，回车确认）：
 ◯  Cursor
 ⬤  Claude Code
 ⬤  OpenCode
 ◯  Gemini CLI
 ◯  IFlow CLI

? 配置到当前项目（否则为全局配置）？ (y/N) n
? 是否自动覆盖已存在的文件？ (y/N) y

开始迁移...
✓ 迁移 Commands... (2/2)
✓ 迁移 Skills... (1/1)
✓ 迁移 Rules... (1/1)
✓ 迁移 MCP... (1/1)

--- 迁移完成 ---
工具: Claude Code, OpenCode
成功: 15
跳过: 3
错误: 0
```

## 自定义配置

你可以通过在项目根目录创建 `ai-sync.config.js` 文件来深度自定义同步行为

### 1. 使用 `defineConfig`

通过 `defineConfig` 你可以定义新的工具配置，或修改现有工具的同步逻辑：

```typescript
import { defineConfig } from '@jl-org/ai-sync'

export default defineConfig({
  tools: {
    // 定义一个新的工具：test-cli
    'test-cli': {
      name: 'Test CLI',
      // 支持的配置类型
      supported: ['commands', 'skills', 'rules', 'mcp'],
      // 具体的转换逻辑
      commands: {
        source: '.test-cli/commands',
        format: 'markdown',
        target: '~/.test-cli/commands',
      },
      rules: {
        source: '.test-cli/rules',
        target: '~/.test-cli/RULES.md',
        // 开启合并模式：将多个规则合并为一个文件
        merge: true,
        // 高度自定义转换逻辑
        transform: (content, fileName) => {
          return `${content}\n\n> Generated from ${fileName}`
        }
      }
    }
  }
})
```

## 执行规则

### 配置转换规则

| 配置类型 | 转换说明 |
|---------|--------|
| **Commands** | Claude → Cursor/OpenCode：直接复制<br>Claude → Gemini/IFlow：Markdown → TOML 自动转换 |
| **Skills** | 所有工具：直接复制 |
| **Rules** | Cursor → 其他工具：.mdc 文件合并为单个 Markdown<br>其他工具 → Cursor：保持多文件结构 |
| **MCP** | Claude → Cursor/OpenCode/Gemini/IFlow：自动格式转换 |

### 路径规则

- **工具配置**：统一使用全局 Home 目录下的配置路径，如 `~/.cursor/`、`~/.claude/`
- **路径解析**：支持使用 `~` 表示用户主目录，自动处理跨平台路径
- **默认目录**：默认使用家目录 `~` 作为配置探测起点，优先查找 `~/.claude`
- **指定路径**：支持通过命令行参数或配置文件指定自定义的源目录和目标项目目录
