export type RecognitionProvider = 'browser' | 'openai-realtime' | 'doubao-realtime'
export type RecognitionLanguage = 'zh-CN' | 'en-US'
export type ContextMode = 'off' | 'draft' | 'recent'
export type OpenAIRealtimeVoiceId = 'marin' | 'cedar' | 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse'

export interface SessionAssistantSettings {
  recognitionProvider: RecognitionProvider
  recognitionLang: RecognitionLanguage
  openaiRealtimeModel: string
  openaiRealtimeVoice: OpenAIRealtimeVoiceId
  doubaoRealtimeModel: string
  openaiContextMode: ContextMode
  /** Wake word that reactivates the voice assistant from standby; empty disables standby wake-up. */
  wakeWord: string
}

export const OPENAI_REALTIME_VOICES = [
  { id: 'marin', name: 'Marin', recommended: true },
  { id: 'cedar', name: 'Cedar', recommended: true },
  { id: 'alloy', name: 'Alloy' },
  { id: 'ash', name: 'Ash' },
  { id: 'ballad', name: 'Ballad' },
  { id: 'coral', name: 'Coral' },
  { id: 'echo', name: 'Echo' },
  { id: 'sage', name: 'Sage' },
  { id: 'shimmer', name: 'Shimmer' },
  { id: 'verse', name: 'Verse' },
] as const
const OPENAI_VOICE_IDS = new Set<string>(OPENAI_REALTIME_VOICES.map(voice => voice.id))

export const DEFAULT_SETTINGS: SessionAssistantSettings = {
  recognitionProvider: 'doubao-realtime',
  recognitionLang: 'zh-CN',
  openaiRealtimeModel: '',
  openaiRealtimeVoice: 'marin',
  doubaoRealtimeModel: '',
  openaiContextMode: 'recent',
  wakeWord: '你好助手',
}

export const DECLARED_SETTINGS_FIELDS = Object.freeze(Object.keys(DEFAULT_SETTINGS) as (keyof SessionAssistantSettings)[])

export function normalizeSettings(input: unknown): SessionAssistantSettings {
  const source = input !== null && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {}
  const provider = source.recognitionProvider
  const language = source.recognitionLang
  const contextMode = source.openaiContextMode
  const route = (field: string) => typeof source[field] === 'string' && /^[A-Za-z0-9._:/-]{0,180}$/.test(source[field]) ? source[field] : ''
  return {
    recognitionProvider: provider === 'browser' || provider === 'openai-realtime' || provider === 'doubao-realtime' ? provider : DEFAULT_SETTINGS.recognitionProvider,
    recognitionLang: language === 'en-US' || language === 'zh-CN' ? language : DEFAULT_SETTINGS.recognitionLang,
    openaiRealtimeModel: route('openaiRealtimeModel'),
    openaiRealtimeVoice: typeof source.openaiRealtimeVoice === 'string' && OPENAI_VOICE_IDS.has(source.openaiRealtimeVoice) ? source.openaiRealtimeVoice as OpenAIRealtimeVoiceId : DEFAULT_SETTINGS.openaiRealtimeVoice,
    doubaoRealtimeModel: route('doubaoRealtimeModel'),
    openaiContextMode: contextMode === 'off' || contextMode === 'draft' || contextMode === 'recent' ? contextMode : DEFAULT_SETTINGS.openaiContextMode,
    wakeWord: typeof source.wakeWord === 'string' && source.wakeWord.length <= 24 ? source.wakeWord : DEFAULT_SETTINGS.wakeWord,
  }
}
