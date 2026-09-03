/**
 * Settings 转换器（Claude settings.json → 各工具格式）
 */

/** ZCode 支持的 Hook 事件，与 Claude Code 的交集为后五个 */
const ZCODE_HOOK_EVENTS = new Set([
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PermissionRequest',
  'PostToolUse',
  'PostToolUseFailure',
  'Stop',
])

/**
 * 转换为 ZCode Settings 格式
 *
 * ZCode 的 Hooks 位于 `hooks.events` 下且必须显式 `hooks.enabled: true` 才生效；
 * 仅迁移双方都支持的事件，Claude 的 `permissions` / `model` 等专属 schema 不迁移
 */
export function convertToZCodeSettingsFormat(sourceConfig: any): any {
  const sourceHooks = sourceConfig?.hooks
  const result: Record<string, any> = {}

  if (!sourceHooks || typeof sourceHooks !== 'object' || Array.isArray(sourceHooks)) {
    return result
  }

  const events: Record<string, any> = {}
  for (const [event, handlers] of Object.entries(sourceHooks)) {
    const hasHandlers = Array.isArray(handlers) && handlers.length > 0
    if (ZCODE_HOOK_EVENTS.has(event) && hasHandlers) {
      events[event] = (handlers as any[]).map(normalizeZCodeHookEntry)
    }
  }

  if (Object.keys(events).length > 0) {
    result.hooks = { enabled: true, events }
  }

  return result
}

/**
 * 归一化单条 Hook 配置
 * Claude 的 `type: 'command'` 在 ZCode 中无此执行器类型，移除后 `command` 字符串直接交给 shell 执行
 */
function normalizeZCodeHookEntry(entry: any): any {
  if (!entry || typeof entry !== 'object' || !Array.isArray(entry.hooks)) {
    return entry
  }

  return {
    ...entry,
    hooks: entry.hooks.map((hook: any) => {
      const { type, ...rest } = hook || {}
      return type === 'command'
        ? rest
        : hook
    }),
  }
}
