# AI Agent 指南 - ai-sync 项目

本文档为在 `ai-sync` 项目上工作的 AI Agent 提供必要信息。遵循这些指南以确保一致性和质量。

## 项目概览
`ai-sync` 是一个基于 TypeScript 的 CLI 工具，用于在不同 AI 工具（如 Cursor、Claude Code、OpenCode 等）之间迁移 AI 配置（Commands、Skills、Rules、MCP）

- **技术栈**: TypeScript、Node.js (ESM)、pnpm、Vitest、ESLint (Antfu 配置)、tsup
- **核心逻辑**: 位于 `src/lib/`，包含迁移器和转换器

## 文件结构
- `src/index.ts`: CLI 入口点
- `src/lib/configs/`: 工具特定配置
- `src/lib/converters/`: 数据格式转换逻辑（例如 Markdown 到 TOML）
- `src/lib/migrators/`: 每个工具的高级迁移逻辑
- `src/lib/utils/`: 共享工具函数（文件 I/O、Logger 等）
- `tests/`: Vitest 测试套件

## 特殊说明
- 添加新工具支持时，更新 `src/lib/configs/` 并实现必要的迁移器/转换器
- 参考 `docs/sync-rules.md` 了解特定工具配置路径和转换逻辑
- 遵守 `eslint.config.mjs` 设置，特别是 `forceTernary` 和 `docComment` 规则
- 如果在代码中发现 `// @TODO` 或 `// FIXME`，在任务范围内解决它们

---

## CLI 交互规则
- 支持交互式选择和命令行参数两种模式
- 无参数时进入完全交互式选择
- 有参数时快速执行，跳过交互
- 工具选择支持多选，逗号分隔
- 支持 -s 指定源目录、-t 指定目标工具、-y 自动覆盖等参数

## 配置加载规则
- 自动查找家目录或指定目录中的 ai-sync.config.js 配置文件
- 支持 CommonJS 和 ESM 格式
- 支持 package.json 中的 ai-sync 字段配置
- 自定义配置与默认配置合并，自定义配置优先级更高

## Rules 优先级规则
同步时按以下顺序优先选择规则源：
`~.claude/{CLAUDE.md,AGENTS.md}`

> 注意：不再向 Cursor 迁移 Rules，因为 Cursor 已支持自动检测 `~/.claude/CLAUDE.md`

## Commands 转换总结对比

| 特性 | Gemini CLI | Cursor | Claude Code | CodeBuddy | OpenCode | Codex CLI |
|------|------------|---------|-------------|-----------|----------|-----------|
| 文件格式 | TOML | Markdown | Markdown | Markdown | Markdown / JSON | TOML / YAML |
| 项目位置 | `.gemini/commands/` | `.cursor/commands/` | `.claude/commands/` | `.codebuddy/commands/` | `.opencode/commands/` | `.codex/prompts/` |
| 全局位置 | `~/.gemini/commands` | `~/.cursor/commands/` | `~/.claude/commands/` | `~/.codebuddy/commands/` | `~/.config/opencode/commands/` | `~/.codex/prompts/` |
| 参数语法 | `{{args}}` | 无特殊语法 | `$ARGUMENTS`, `$1`, `$2` | `$ARGUMENTS`, `$1`, `$2` | `$ARGUMENTS`, `$1`, `$2` | `$ARGUMENTS`, `$1`, `$2`, 命名参数 |
| Shell执行 | `!{command}` | 不支持 | `!`command`` (需声明 allowed-tools) | `!`command`` (需声明 allowed-tools) | `!`command`` (无需声明) | 配置文件白名单 |
| 文件引用 | `@{filepath}` | 不支持 | `@filename` | `@filename` | `@filename` | `@filename` |
| 命名空间 | 子目录 | 子目录 | 子目录 | 子目录 | 子目录 | 子目录 |
| Frontmatter | 不支持 | 不支持 | 支持 | 支持 | 支持 | 支持 |

## Skills
各家基本一致，都是符合 Claude Code 技能模块规范的 Markdown 文件，仅仅更换文件夹

## MCP

### 优先级规则
同步时按以下顺序优先选择 MCP 源：
`~/.claude.json`（Claude Code MCP 配置文件，默认）

### OpenCode
`~/.config/opencode/opencode.jsonc`
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "context7-mcp": {
      "type": "local",
      "command": [
        "npx",
        "@upstash/context7-mcp"
      ],
      "enabled": true
    },
    "figma-mcp": {
      "type": "remote",
      "url": "http://127.0.0.1:3845/sse",
      "enabled": true
    },
    "apifox-mcp": {
      "type": "local",
      "command": [
        "npx",
        "apifox-mcp-server",
        "--project-id=xxx",
        // 注意环境变量配法，官方配置会报错。@link https://github.com/anomalyco/opencode/issues/2978
        "{env:APIFOX_ACCESS_TOKEN}"
      ],
      "enabled": true
    }
  }
}
```

### Claude Code
`~/.claude.json`
```json
{
  "mcpServers": {
    "lsp-mcp": {
      "type": "http",
      "url": "http://127.0.0.1:9527/mcp"
    },
    "context7-mcp": {
      "command": "npx",
      "args": [
        "@upstash/context7-mcp@v1.0.17"
      ]
    }
  },
}
```

### Gemini
`~/.gemini/settings.json`
```json
{
  "mcpServers": {
    "context7-mcp": {
      "command": "npx",
      "args": [
        "@upstash/context7-mcp@v1.0.17"
      ]
    },
    "lsp-mcp": {
      "httpUrl": "http://127.0.0.1:9527/mcp",
      "type": "streamable-http"
    }
  }
}
```

### IFlow
同 Gemini，目录换成 `~/.iflow/settings.json`

### CodeX
`~/.codex/config.toml`
```toml
[mcp_servers.context7]
command = "npx"
args = [
  "-y",
  "@upstash/context7-mcp"
]

[mcp_servers.context7.env]
MY_ENV_VAR = "MY_ENV_VALUE"

[mcp_servers.figma]
url = "https://mcp.figma.com/mcp"
bearer_token_env_var = "FIGMA_OAUTH_TOKEN"
http_headers = { X-Figma-Region = "us-east-1" }
```

### Cursor
`~/.cursor/mcp.json`
```json
{
  "mcpServers": {
    "context7-mcp": {
      "command": "npx",
      "args": [
        "@upstash/context7-mcp"
      ]
    },
    "figma-mcp": {
      // sse 直接写 url
      "url": "http://192.168.5.176:3845/sse"
    },
    "ref-mcp": {
      // HTTPStreamable
      "type": "http",
      "url": "https://api.ref.tools/mcp?apiKey=ref-73eda307015b69d3e6d9"
    }
  }
}
```

### CodeBuddy
`~/.codebuddy/.mcp.json`
```json
{
  "mcpServers": {
    "lsp-mcp": {
      "type": "http",
      "url": "http://127.0.0.1:9527/mcp"
    },
    "context7-mcp": {
      "command": "npx",
      "args": [
        "@upstash/context7-mcp@v1.0.17"
      ]
    }
  }
}
```

> **注意**: CodeBuddy 的配置与 Claude Code 完全一致，包括 Hooks 支持。配置文件路径为 `~/.codebuddy/.mcp.json` 或项目级别的 `.codebuddy/.mcp.json`。

## 注意事项规则
- OpenCode 对 Claude Skills 兼容性有限，某些高级字段会被忽略
- 路径处理需正确处理 `~` 展开和跨平台路径分隔符
- 默认使用家目录 `~` 作为配置源探测目录
- MCP 配置统一使用 Claude Code 的 `~/.claude.json` 作为源配置名
- OpenCode MCP 配置的 `command` 字段需转换为数组格式
- Gemini/IFlow 的远程 MCP 需使用 `httpUrl` 字段而非 `url`
- OpenCode MCP 配置需添加 `type` 和 `enabled` 字段
- 环境变量传递方式在不同工具间存在差异，需注意转换规则
- **CodeBuddy 与 Claude Code 配置完全兼容**，支持所有 Claude Code 的特性（Commands、Skills、Rules、MCP、Hooks）
- CodeBuddy 的配置目录为 `~/.codebuddy`，Rule 文件为 `CODEBUDDY.md`，MCP 配置为 `.mcp.json`
