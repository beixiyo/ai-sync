import type { ToolKey, ToolConfig } from '../types/config'
import { cursorConfig } from './cursor'
import { claudeConfig } from './claude'
import { opencodeConfig } from './opencode'
import { geminiConfig } from './gemini'
import { iflowConfig } from './iflow'
import { codexConfig } from './codex'

export const DEFAULT_TOOL_CONFIGS: Record<ToolKey, ToolConfig> = {
  cursor: cursorConfig,
  claude: claudeConfig,
  opencode: opencodeConfig,
  gemini: geminiConfig,
  iflow: iflowConfig,
  codex: codexConfig
}
