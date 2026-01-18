## 1. 工具配置规则
各 AI IDE 工具的配置路径：
- Cursor: ~/.cursor
- Claude Code: ~/.claude
- OpenCode: ~/.config/opencode
- Gemini CLI: ~/.gemini
- IFlow CLI: ~/.iflow
- Codex: ~/.codex

## 2. 配置可复用性规则
### 2.1 Claude 到各工具的转换规则

#### 2.1.1 Commands 转换
- **Claude → Cursor**：直接复制 Markdown 文件到 `~/.cursor/commands/`
- **Claude → OpenCode**：直接复制 Markdown 文件到 `~/.config/opencode/command/`
- **Claude → Gemini CLI**：转换 Markdown 为 TOML 格式后复制到 `~/.gemini/commands/`
- **Claude → IFlow CLI**：转换 Markdown 为 TOML 格式后复制到 `~/.iflow/commands/`
- **Claude → Codex**：直接复制 Markdown 文件到 `~/.codex/prompts/`（全局）或 `.codex/prompts/`（项目）
- **Claude → Claude Code**：直接使用原始配置，无需转换

#### 2.1.2 Skills 转换
- **Claude → Cursor**：直接复制 Markdown 文件到 `~/.cursor/skills/`
- **Claude → OpenCode**：直接复制 Markdown 文件到 `~/.config/opencode/skill/`（部分高级字段可能被忽略）
- **Claude → Gemini CLI**：直接复制 Markdown 文件到 `~/.gemini/skills/`
- **Claude → IFlow CLI**：直接复制 Markdown 文件到 `~/.iflow/skills/`
- **Claude → Codex**：直接复制 Markdown 文件到 `~/.codex/skills/`（全局）或 `.codex/skills/`（项目）
- **Claude → Claude Code**：直接使用原始配置，无需转换

#### 2.1.3 Rules 转换
- **Claude → Cursor**：转换为 .mdc 多文件格式后复制到 `~/.cursor/rules/`
- **Claude → OpenCode**：合并为单个 Markdown 文件后保存为 `~/.config/opencode/AGENTS.md`
- **Claude → Gemini CLI**：合并为单个 Markdown 文件后保存为 `~/.gemini/GEMINI.md`
- **Claude → IFlow CLI**：合并为单个 Markdown 文件后保存为 `~/.iflow/IFLOW.md`
- **Claude → Codex**：合并为单个 Markdown 文件后保存为 `~/.codex/AGENTS.md`
- **Claude → Claude Code**：直接使用原始配置（CLAUDE.md），无需转换

#### 2.1.4 MCP 转换
- **Claude → Cursor**：转换为 Cursor MCP 格式后保存到 `~/.cursor/mcp.json`
- **Claude → OpenCode**：转换为 OpenCode MCP 格式后合并到 `~/.config/opencode/opencode.jsonc`
- **Claude → Gemini CLI**：转换为 Gemini MCP 格式后合并到 `~/.gemini/settings.json`
- **Claude → IFlow CLI**：转换为 IFlow MCP 格式后合并到 `~/.iflow/settings.json`
- **Claude → Codex**：转换为 Codex TOML 格式后合并到 `~/.codex/config.toml`
- **Claude → Claude Code**：直接使用原始配置，无需转换

### 2.2 Cursor Rules 到各工具的转换规则
- **Cursor → Claude Code**：合并 .mdc 多文件为单个 Markdown 文件后保存为 `~/.claude/CLAUDE.md`
- **Cursor → OpenCode**：合并 .mdc 多文件为单个 Markdown 文件后保存为 `~/.config/opencode/AGENTS.md`
- **Cursor → Gemini CLI**：合并 .mdc 多文件为单个 Markdown 文件后保存为 `~/.gemini/GEMINI.md`
- **Cursor → IFlow CLI**：合并 .mdc 多文件为单个 Markdown 文件后保存为 `~/.iflow/IFLOW.md`
- **Cursor → Cursor**：直接使用原始配置，无需转换

## 3. CLI 交互规则
- 支持交互式选择和命令行参数两种模式
- 无参数时进入完全交互式选择
- 有参数时快速执行，跳过交互
- 工具选择支持多选，逗号分隔
- 支持 -s 指定源目录、-t 指定目标工具、-p 指定为项目级路径、-d 指定项目目录、-y 自动覆盖等参数

## 4. 配置加载规则
- 自动查找家目录或指定目录中的 ai-sync.config.js 配置文件
- 支持 CommonJS 和 ESM 格式
- 支持 package.json 中的 ai-sync 字段配置
- 自定义配置与默认配置合并，自定义配置优先级更高

## 5. Rules 优先级规则
### 5.1 规则源优先级
同步时按以下顺序优先选择规则源：
1. AGENTS.md/AGENT.md
2. CLAUDE.md（Claude Code 规则文件）
3. .claude/ 目录下的上述文件
4. .cursor/rules/（Cursor 规则目录，默认）

## 5.2 MCP 优先级规则
### 5.2.1 MCP 源优先级
同步时按以下顺序优先选择 MCP 源：
1. .claude.json（Claude Code MCP 配置文件，默认）
2. .claude/.claude.json

## 10. 注意事项规则
- OpenCode 对 Claude Skills 兼容性有限，某些高级字段会被忽略
- 路径处理需正确处理 ~ 展开和跨平台路径分隔符
- 默认使用家目录 `~` 作为配置源探测目录
- MCP 配置统一使用 Claude Code 的 .claude.json 作为源配置名
- OpenCode MCP 配置的 `command` 字段需转换为数组格式
- Gemini/IFlow 的远程 MCP 需使用 `httpUrl` 字段而非 `url`
- OpenCode MCP 配置需添加 `type` 和 `enabled` 字段
- 环境变量传递方式在不同工具间存在差异，需注意转换规则

