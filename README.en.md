# AI Tool Configuration Sync

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

Sync Claude configuration and shared skills across AI tools.

## Supported Tools

- Cursor
- Claude Code
- CodeBuddy
- OpenCode
- CodeX
- Gemini CLI
- IFlow CLI
- ZCode
- Pi

## Quick Start

### 1. Prepare Configuration

Follow the [Claude Code configuration format](https://code.claude.com/docs/settings) and prepare the files you want to sync:

- `~/.claude/commands/` — Custom commands in Markdown
- `~/.agents/skills/` — Shared skills
- `~/.claude/CLAUDE.md` — Instructions
- `~/.claude.json` — MCP configuration

### 2. Run the CLI

```bash
npm i -g @jl-org/ai-sync

# Interactive execution
ai-sync
# View help
ai-sync --help
```

```bash
? Select tools to migrate (use arrow keys, space to select, enter to confirm):
 ◯  Cursor
 ⬤  Claude Code
 ⬤  OpenCode
 ◯  Gemini CLI
 ◯  IFlow CLI

? Auto-overwrite existing files? (y/N) y

Starting migration...
✓ Migrating Commands... (2/2)
✓ Migrating Skills... (1/1)
✓ Migrating MCP... (1/1)

--- Migration Complete ---
Tools: Claude Code, OpenCode
Success: 15
Skipped: 3
Errors: 0
```

## Custom Configuration

Create `ai-sync.config.js` in the project root.

### 1. Using `defineConfig`

Use `defineConfig` to add a tool or override its sync settings:

```typescript
import { defineConfig } from '@jl-org/ai-sync'

export default defineConfig({
  tools: {
    // Define a new tool: test-cli
    'test-cli': {
      name: 'Test CLI',
      // Supported configuration types
      supported: ['commands', 'skills', 'mcp'],
      // Specific transformation logic
      commands: {
        source: '.test-cli/commands',
        format: 'markdown',
        target: '~/.test-cli/commands',
      }
    },
    // Modify an existing tool: disable Skills symlink mode and fall back to copy
    'cursor': {
      skills: { symlink: false },
    }
  }
})
```

### Skills Source Filtering

The top-level `synced` entry is excluded by default so Claude-generated content does not propagate to other tools. The same policy applies to all targets and symlink, copy, and transform modes.

```js
export default {
  global: {
    skills: {
      excludeEntries: ['synced', 'private-skill'],
    },
  },
}
```

Entries are exact top-level names, not paths or globs; nested entries inside a skill are unaffected. A custom array replaces the default list; use `excludeEntries: []` to disable filtering.

In symlink mode, exclusions only prevent new links; existing entries are never removed. In explicit copy or transform mode, existing links to the corresponding excluded source entries are removed.

## Execution Rules

### Configuration Transformation Rules

| Configuration Type | Transformation Description |
|-------------------|---------------------------|
| **Commands** | Claude → Cursor/OpenCode/ZCode: Direct copy<br>Claude → Gemini/IFlow: Markdown → TOML automatic conversion<br>Claude → Pi: prompt templates (Claude-only frontmatter stripped) |
| **Skills** | Add missing symlinks from selected tools to `~/.agents/skills/`. Correct links are left alone. Conflicting files, directories, and links (including broken links) are reported and never overwritten, even with `-y`. |
| **Instructions** | `CLAUDE.md` → tool-specific instruction files: Gemini (`GEMINI.md`), Codex/OpenCode/Cursor/IFlow/ZCode (`AGENTS.md`), CodeBuddy (`CODEBUDDY.md`), Pi (`~/.pi/agent/AGENTS.md`) |
| **MCP** | Claude → Cursor/OpenCode/Gemini/IFlow/ZCode: Automatic format conversion<br>Claude → Pi: native MCP (written to `~/.pi/agent/mcp.json`), same structure; adds `oauth.clientName` for Figma and keeps per-server `exposure`/`enabled` etc. already set in pi |
| **Settings** | Claude → CodeBuddy: Direct copy<br>Claude → ZCode: Only compatible Hook events (wrapped into `hooks.events` structure) |

### Unsupported Configurations

| Configuration Type | Reason |
|-------------------|--------|
| **Rules** | Only Cursor and Claude Code support a Rules system with file path scoping — other tools lack this feature, making sync impractical. You can use nested `AGENTS.md` files (e.g. `project/src/api/AGENTS.md`) as a directory-level scoping alternative |
| **Hooks** | Hooks implementations are entirely different: Claude Code / Codex / Cursor use JSON + Shell, OpenCode uses TypeScript — formats and execution mechanisms cannot be unified |

### Path Rules

- **Tool configuration**: Targets use global paths such as `~/.claude/` by default.
- **Path resolution**: `~` expands to your home directory.
- **Source root**: Defaults to `~`. With `-s <dir>`, skills are read from `<dir>/.agents/skills`; other configuration types keep their Claude-based paths.
- **Custom paths**: Set the source root with `-s` or override tool paths in the configuration file.
