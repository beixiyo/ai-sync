# Changelog

## 1.3.0 - 2026-10-12

### Added

- Skills 同步新增软链接模式（默认开启）：各工具 skills 目录中的每个条目以符号链接指向 `~/.claude/skills/` 下的源，只有源保留真实文件；目标中已存在的同名复制文件/目录会被删除并替换为链接，指向已删除源的失效链接自动清理，与源无关的条目保持不动
- 新增 `SkillConfig.symlink` 配置项，设为 `false` 可回退为复制模式；配置了 `transform` 的工具仍走转换复制逻辑；Windows 上目录链接使用 junction，无需管理员权限

### Security

- 链接替换采用「先建临时链接、成功后再替换旧内容」的事务性顺序，临时/备份路径带唯一后缀（不触碰无关同名条目）；任何阶段失败都保留旧内容，恢复失败时保留备份并在错误信息中说明位置
- 目标目录与源互为别名（如整个目标目录已链接到源）、存在包含关系，或被配置在源内部时整体跳过；交叉布局（源条目本身是指向目标目录内部的链接，如 skills CLI 安装布局）时逐条目跳过，绝不把目标处的真实数据当作旧副本替换或删除
- 从软链接模式切回复制/转换模式时自动解除遗留链接（按词法+物理双重路径比较，覆盖源别名/换源场景），解除失败则中止该工具迁移并报错；写入前若目标是符号链接（含断链、目录链接）一律先解除且不以 autoOverwrite 为条件，递归复制进入目录前同样处理，彻底避免沿链接写穿源文件；源条目本身是链接时保留目标链接，交叉布局切复制不丢 skill
- 失效链接清理仅依据明确的 ENOENT，权限等异常保守保留链接；CLI 帮助与交互提示标明 Skills 软链接模式不受 autoOverwrite 影响

## 1.2.0 - 2026-10-01

### Changed

- Pi 的 MCP 目标改为 pi 原生配置 `~/.pi/agent/mcp.json`（pi 0.99+ 内置 MCP，不再读取 `~/.config/mcp/mcp.json`），不再兼容 `pi-mcp-adapter` 的旧路径；装有 `pi-mcp-adapter` 时它会整体替换内置 MCP，需从 pi packages 中移除

### Added

- 同步 MCP 到 Pi 时保留目标文件中已有 server 的 `exposure` / `toolExposure` / `enabled` / `description` / `timeout`（如在 pi `/mcp` 中修改的设置）；新增 `MCPConfig.preserveExisting` 钩子

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
