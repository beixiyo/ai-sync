/**
 * Hooks 转换器 - 将 Cursor Hooks 转换为 Claude 格式
 */

import { readFile, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { ensureDirectoryExists } from '../utils/file'

/**
 * 将 Cursor Hooks 转换为 Claude 格式
 */
export async function convertHooksForClaude(
  sourceHooksDir: string,
  sourceConfigFile: string,
  targetFile: string
): Promise<void> {
  let cursorHooks: CursorHooks = {}

  try {
    const configContent = await readFile(sourceConfigFile, 'utf-8')
    cursorHooks = JSON.parse(configContent) as CursorHooks
  } catch (error) {
    console.warn(`读取 hooks.json 失败: ${sourceConfigFile}`)
    return
  }

  const claudeSettings: ClaudeSettings = {}

  if (cursorHooks.hooks?.afterFileEdit) {
    claudeSettings.PostToolUse = cursorHooks.hooks.afterFileEdit.map((hook) => ({
      matcher: 'Write|Edit',
      hooks: [{
        type: 'command',
        command: hook.command.replace('~/.cursor/hooks', '${CLAUDE_PLUGIN_ROOT}/hooks'),
        timeout: 30
      }]
    }))
  }

  if (cursorHooks.hooks?.beforeShellExecution) {
    claudeSettings.PreToolUse = cursorHooks.hooks.beforeShellExecution.map((hook) => ({
      matcher: 'Bash',
      hooks: [{
        type: 'command',
        command: hook.command,
        timeout: 30
      }]
    }))
  }

  if (cursorHooks.hooks?.stop) {
    claudeSettings.Stop = cursorHooks.hooks.stop.map((hook) => ({
      hooks: [{
        type: 'command',
        command: hook.command,
        timeout: 30
      }]
    }))
  }

  await ensureDirectoryExists(dirname(targetFile))
  await writeFile(targetFile, JSON.stringify(claudeSettings, null, 2), 'utf-8')
}

// 类型定义
interface CursorHook {
  command: string
}

interface CursorHooks {
  hooks?: {
    afterFileEdit?: CursorHook[]
    beforeShellExecution?: CursorHook[]
    stop?: CursorHook[]
  }
}

interface ClaudeHook {
  type: string
  command: string
  timeout: number
}

interface ClaudeToolHook {
  matcher?: string
  hooks: ClaudeHook[]
}

interface ClaudeSettings {
  PostToolUse?: ClaudeToolHook[]
  PreToolUse?: ClaudeToolHook[]
  Stop?: ClaudeToolHook[]
}