# Changelog

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)

## [1.0.6] - 2026-06-19

### Changed

- 迁移 MCP 配置到 Codex 时，自动为每个 server 写入 `default_tools_approval_mode = "approve"`，使其工具默认免确认执行（本地与远程 server 均生效）

### Fixed

- 迁移到 JSONC 目标（如 `.claude.json`、`opencode.jsonc`）时不再丢失未改动字段的注释（改用 `comment-json` 读写）
- 迁移到 TOML 目标（如 Codex `config.toml`）时尽量保留未改动配置的注释：只重写发生变化的顶层表，其余文本逐字保留；无法安全保留时回退到完整序列化以保证输出始终合法
