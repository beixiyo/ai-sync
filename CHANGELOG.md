# Changelog

## 1.0.10 - 2026-09-03

### Added

- 新增 ZCode（智谱 Z.ai）迁移支持：Commands / Skills / Agents 与 Claude Code 格式兼容直接复制，`CLAUDE.md` → `~/.zcode/AGENTS.md`
- MCP 迁移到 ZCode 时转换为 `~/.zcode/cli/config.json` 的 `mcp.servers` 嵌套结构（远程 `httpUrl` 归一化为 `url`）
- Settings 迁移到 ZCode 时仅迁移双方兼容的 Hook 事件，自动包装为 `hooks.events` 结构并显式 `hooks.enabled: true`；Claude 专属事件与 `permissions` 不迁移

## 1.0.8 - 2026-07-21

### Fixed

- Markdown Command 转换为 Gemini / IFlow TOML 时，仅将 Claude Code 的 `` !`command` `` 语法转换为 `!{command}`，不再将普通行内代码误识别为 Shell 执行
- Markdown Command 中的围栏代码块现在会原样保留，避免 Gemini / IFlow 将示例代码当作 Shell 命令执行

## 1.0.7 - 2026-06-28

### Fixed

- 迁移 MCP 配置时正确转换环境变量引用：Claude Code `${VAR}` 会按目标工具转换为 OpenCode `{env:VAR}`、Codex `env_vars` / `env_http_headers` / `bearer_token_env_var`
- 迁移到 Codex 时，若 MCP 参数中包含环境变量引用，会自动生成 `sh -lc` wrapper，避免 `args` 字面量导致环境变量无法展开

## 1.0.6 - 2026-06-19

### Changed

- 迁移 MCP 配置到 Codex 时，自动为每个 server 写入 `default_tools_approval_mode = "approve"`，使其工具默认免确认执行（本地与远程 server 均生效）

### Fixed

- 迁移到 JSONC 目标（如 `.claude.json`、`opencode.jsonc`）时不再丢失未改动字段的注释（改用 `comment-json` 读写）
- 迁移到 TOML 目标（如 Codex `config.toml`）时尽量保留未改动配置的注释：只重写发生变化的顶层表，其余文本逐字保留；无法安全保留时回退到完整序列化以保证输出始终合法
