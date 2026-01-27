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

Automated script to migrate Claude configurations to different AI IDE tools

## Supported Tools

- Cursor
- Claude Code
- CodeBuddy
- OpenCode
- CodeX
- Gemini CLI
- IFlow CLI

## Quick Start

### 1. Prepare Configuration

**Follow Claude Code Configuration Specification** https://code.claude.com/docs/settings

Create `~/.claude` directory with the following subdirectories:
- `~/.claude/commands/` - Custom commands (Markdown format)
- `~/.claude/skills/` - Skill modules (Markdown format)
- `~/.claude/{CLAUDE.md,AGENTS.md}` - IDE rules
- `~/.claude.json` - MCP configuration file

### 2. Quick Start

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

? Configure to current project (otherwise global config)? (y/N) n
? Auto-overwrite existing files? (y/N) y

Starting migration...
✓ Migrating Commands... (2/2)
✓ Migrating Skills... (1/1)
✓ Migrating Rules... (1/1)
✓ Migrating MCP... (1/1)

--- Migration Complete ---
Tools: Claude Code, OpenCode
Success: 15
Skipped: 3
Errors: 0
```

## Custom Configuration

You can deeply customize the sync behavior by creating an `ai-sync.config.js` file in the project root directory

### 1. Using `defineConfig`

With `defineConfig`, you can define new tool configurations or modify existing tool sync logic:

```typescript
import { defineConfig } from '@jl-org/ai-sync'

export default defineConfig({
  tools: {
    // Define a new tool: test-cli
    'test-cli': {
      name: 'Test CLI',
      // Supported configuration types
      supported: ['commands', 'skills', 'rules', 'mcp'],
      // Specific transformation logic
      commands: {
        source: '.test-cli/commands',
        format: 'markdown',
        target: '~/.test-cli/commands',
      },
      rules: {
        source: '.test-cli/rules',
        target: '~/.test-cli/RULES.md',
        // Enable merge mode: merge multiple rules into a single file
        merge: true,
        // Highly customizable transformation logic
        transform: (content, fileName) => {
          return `${content}\n\n> Generated from ${fileName}`
        }
      }
    }
  }
})
```

## Execution Rules

### Configuration Transformation Rules

| Configuration Type | Transformation Description |
|-------------------|---------------------------|
| **Commands** | Claude → Cursor/OpenCode: Direct copy<br>Claude → Gemini/IFlow: Markdown → TOML automatic conversion |
| **Skills** | All tools: Direct copy |
| **Rules** | Cursor → Other tools: .mdc files merged into single Markdown<br>Other tools → Cursor: Do not migrate (Cursor supports auto-detecting ~/.claude/CLAUDE.md) |
| **MCP** | Claude → Cursor/OpenCode/Gemini/IFlow: Automatic format conversion |

### Path Rules

- **Tool Configuration**: Unified use of global Home directory configuration paths, such as `~/.cursor/`, `~/.claude/`
- **Path Resolution**: Support using `~` to represent the user's home directory, automatically handles cross-platform paths
- **Default Directory**: Default to using home directory `~` as the configuration detection starting point, with `~/.claude` as the sole configuration standard
- **Specified Path**: Support specifying custom source and target project directories through command-line parameters or configuration files
