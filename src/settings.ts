import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { settingsNamespace, type SettingsNamespace, type SettingsScope } from '@deepseek-ai/dsh-settings'
import {
  DEFAULT_SETTINGS,
  OPENAI_REALTIME_VOICES,
  normalizeSettings,
  type SessionAssistantSettings,
} from './settings-values.ts'

export * from './settings-values.ts'

export const SETTINGS_NAMESPACE: SettingsNamespace = settingsNamespace('session-assistant')

export const Config: z<SessionAssistantSettings> = z.object({
  recognitionProvider: z.union(['browser', 'openai-realtime', 'doubao-realtime'] as const).description('语音后端').default(DEFAULT_SETTINGS.recognitionProvider),
  recognitionLang: z.union(['zh-CN', 'en-US'] as const).description('语音识别语言').default(DEFAULT_SETTINGS.recognitionLang),
  openaiRealtimeModel: z.string().description('OpenAI Realtime 路由；留空自动选择').default(''),
  openaiRealtimeVoice: z.union(OPENAI_REALTIME_VOICES.map(voice => voice.id)).description('OpenAI Realtime 输出音色').default('marin'),
  doubaoRealtimeModel: z.string().description('豆包 Realtime Duplex 路由；留空自动选择').default(''),
  openaiContextMode: z.union(['off', 'draft', 'recent'] as const).description('语音会话上下文范围').default('recent'),
  wakeWord: z.string().max(24).description('待机唤醒词；留空禁用待机唤醒').default('你好助手'),
})

export function registerSessionAssistantSettings(ctx: Context, base: Partial<SessionAssistantSettings>): SettingsScope<SessionAssistantSettings> {
  return ctx.settings.register(SETTINGS_NAMESPACE, Config, {
    base: { ...DEFAULT_SETTINGS, ...normalizeSettings(base) },
    applies: 'live',
  })
}
