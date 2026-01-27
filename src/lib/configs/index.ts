import type { ToolConfig, ToolKey } from '../types/config'
import { claudeConfig } from './claude'
import { codebuddyConfig } from './codebuddy'
import { codexConfig } from './codex'
import { cursorConfig } from './cursor'
import { geminiConfig } from './gemini'
import { iflowConfig } from './iflow'
import { opencodeConfig } from './opencode'

export const DEFAULT_TOOL_CONFIGS: Record<ToolKey, ToolConfig> = {
  cursor: cursorConfig,
  claude: claudeConfig,
  codebuddy: codebuddyConfig,
  opencode: opencodeConfig,
  gemini: geminiConfig,
  iflow: iflowConfig,
  codex: codexConfig,
}
