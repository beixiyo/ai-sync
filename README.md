# IDE Rules 迁移脚本

自动化将 Claude 配置迁移到不同 AI IDE 工具的脚本。

## 支持的工具

- Cursor
- Claude Code
- OpenCode
- CodeX
- Gemini CLI
- IFlow CLI

## 快速开始

### 1. 准备配置

在项目根目录创建 `.claude` 目录，包含以下子目录：
- `.claude/commands/` - 存放自定义命令（Markdown 格式）
- `.claude/skills/` - 存放技能模块（Markdown 格式）
- `.cursor/rules/` - 存放 IDE 规则（.mdc 格式）
- `.claude.json` - MCP 配置文件

### 2. 安装依赖

```bash
pnpm install
```

### 3. 执行迁移

#### 交互式模式（推荐）
```bash
pnpm migrate
```

#### 命令行模式
```bash
# 迁移到单个工具
pnpm migrate -t cursor

# 迁移到多个工具
pnpm migrate -t cursor,claude,opencode

# 自动覆盖现有文件
pnpm migrate -y
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

- **全局配置**：`~/.cursor/`、`~/.claude/`、`~/.config/opencode/`、`~/.gemini/`、`~/.iflow/`
- **项目配置**：当前项目目录下的对应文件夹
- **路径解析**：支持使用 `~` 表示用户主目录
- **默认目录**：默认使用 `~/.claude` 作为配置源目录
- **回退逻辑**：如果 `~/.claude` 不存在，自动检查当前项目的 `.claude` 目录

### 优先级规则

1. **规则源优先级**：AGENTS.md/AGENT.md > CLAUDE.md > .cursor/rules/
2. **MCP 源优先级**：优先使用 `.claude.json` 文件
