import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname } from 'node:path'
import z from '@deepseek-ai/schemastery'
import { PROMPT } from './model/prompt.js'
import {
  END_VOICE_SESSION_TOOL,
  SESSION_ASSISTANT_TOOLS,
  SESSION_ASSISTANT_TOOL_OUTPUT,
  SUBMIT_TO_AGENT_TOOL,
  UPDATE_WORKING_DRAFT_TOOL,
} from './model/tool-surface.js'

export { SESSION_ASSISTANT_TOOL_OUTPUT }

export const name = 'dsh-session-assistant'
export const inject = []

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
]

const OPENAI_REALTIME_VOICE_IDS = new Set(OPENAI_REALTIME_VOICES.map(voice => voice.id))

export const Config = z.object({
  recognitionProvider: z.union([z.const('browser'), z.const('openai-realtime'), z.const('doubao-realtime')]).description('语音后端').default('doubao-realtime'),
  recognitionLang: z.union([z.const('zh-CN'), z.const('en-US')]).description('语音识别语言').default('zh-CN'),
  openaiRealtimeModel: z.string().description('注册的 OpenAI Realtime 路由；留空自动选择').default(''),
  openaiRealtimeVoice: z.union(OPENAI_REALTIME_VOICES.map(voice => z.const(voice.id))).description('OpenAI Realtime 输出音色').default('marin'),
  doubaoRealtimeModel: z.string().description('注册的豆包 Realtime Duplex 路由；留空自动选择').default(''),
  openaiContextMode: z.union([z.const('off'), z.const('draft'), z.const('recent')]).description('语音会话上下文范围').default('recent'),
  autoSpeak: z.boolean().description('自动朗读主 Agent 的新回复').default(false),
  autoSpeakMode: z.union([z.const('final'), z.const('all')]).description('主 Agent 回复朗读范围').default('final'),
  voiceName: z.string().description('浏览器朗读音色；留空自动选择').default(''),
  rate: z.number().description('浏览器朗读语速 0.5~2').default(1),
})

export const CONFIG_PATH = homedir() + '/.dsh/session-assistant.json'
const LEGACY_CONFIG_PATHS = [homedir() + '/.dsh/talk-to-text.json', homedir() + '/.dsh/chatvoice.json']
const MAX_SETTINGS_BYTES = 64 * 1024

export function createSettingsStore(configPath = CONFIG_PATH, legacyPaths = LEGACY_CONFIG_PATHS) {
  return {
    read() {
      for (const path of [configPath, ...legacyPaths]) {
        try {
          const value = JSON.parse(readFileSync(path, 'utf8'))
          if (value && typeof value === 'object' && !Array.isArray(value)) return value
        } catch {
          // Continue through migration sources and then use patch defaults.
        }
      }
      return {}
    },
    write(value) {
      mkdirSync(dirname(configPath), { recursive: true })
      writeFileSync(configPath, JSON.stringify(value, null, 2), 'utf8')
    }
  }
}

const defaultSettingsStore = createSettingsStore()

export function normalize(next) {
  const out = { ...(next || {}) }
  for (const field of ['openaiRealtimeAvailable', 'doubaoRealtimeAvailable', 'realtimeModels', 'openaiVoiceOptions']) delete out[field]
  if (!['browser', 'openai-realtime', 'doubao-realtime'].includes(out.recognitionProvider)) out.recognitionProvider = 'doubao-realtime'
  if (!['zh-CN', 'en-US'].includes(out.recognitionLang)) out.recognitionLang = 'zh-CN'
  for (const field of ['openaiRealtimeModel', 'doubaoRealtimeModel']) {
    if (typeof out[field] !== 'string' || !/^[A-Za-z0-9._:/-]{0,180}$/.test(out[field])) out[field] = ''
  }
  if (!OPENAI_REALTIME_VOICE_IDS.has(out.openaiRealtimeVoice)) out.openaiRealtimeVoice = 'marin'
  if (!['off', 'draft', 'recent'].includes(out.openaiContextMode)) out.openaiContextMode = 'recent'
  if (typeof out.autoSpeak !== 'boolean') out.autoSpeak = false
  if (!['final', 'all'].includes(out.autoSpeakMode)) out.autoSpeakMode = 'final'
  if (typeof out.voiceName !== 'string') out.voiceName = ''
  const rate = Number(out.rate)
  out.rate = Number.isFinite(rate) ? Math.min(2, Math.max(0.5, rate)) : 1
  return out
}

export function effectiveConfig(baseConfig, settingsStore = defaultSettingsStore) {
  return { ...baseConfig, ...settingsStore.read() }
}

export function voiceWorkspaceTool() {
  return UPDATE_WORKING_DRAFT_TOOL
}

export function submitToAgentTool() {
  return SUBMIT_TO_AGENT_TOOL
}

export function endVoiceSessionTool() {
  return END_VOICE_SESSION_TOOL
}

export function realtimeEditorInstructions(context = '') {
  return [PROMPT, context ? `Current projected session context and editable draft:\n${context}` : 'The editable draft is initially empty.'].join('\n\n')
}

export function openAIProfileId(voice) {
  const selected = OPENAI_REALTIME_VOICE_IDS.has(voice) ? voice : 'marin'
  return `session-assistant-openai-${selected}`
}

export function sessionProfile({ id = 'session-assistant', openaiVoice } = {}) {
  return {
    id,
    instructions: realtimeEditorInstructions,
    tools: SESSION_ASSISTANT_TOOLS,
    // Doubao voice belongs to the selected route. OpenAI exposes one profile
    // per supported voice because the provider freezes it after audio starts.
    voice: openaiVoice ? { openai: openaiVoice } : {},
  }
}

export function sessionProfiles() {
  return [
    sessionProfile(),
    ...OPENAI_REALTIME_VOICES.map(voice => sessionProfile({
      id: openAIProfileId(voice.id),
      openaiVoice: voice.id,
    })),
  ]
}

function selectModel(config, models, protocol) {
  const candidates = models.filter(model => model.protocol === protocol)
  const selected = protocol === 'doubao-realtime-duplex' ? config.doubaoRealtimeModel : config.openaiRealtimeModel
  return candidates.find(model => model.id === selected)
    || candidates.find(model => model.model === selected)
    || candidates.find(model => model.available)
    || candidates[0]
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

export function apply(ctx, config = {}, options = {}) {
  const settingsStore = options.settingsStore || defaultSettingsStore
  const getEffective = () => normalize(effectiveConfig(config, settingsStore))
  ctx.inject(['webServer', 'realtimeModelRuntime'], scope => {
    const disposeProfiles = sessionProfiles().map(profile => scope.realtimeModelRuntime.registerProfile(profile))
    if (typeof scope.effect === 'function') {
      scope.effect(() => () => disposeProfiles.forEach(dispose => dispose()), 'dsh-session-assistant.profiles')
    }

    const publicState = async () => {
      const models = await scope.realtimeModelRuntime.publicModels()
      const current = getEffective()
      const openai = selectModel(current, models, 'openai-webrtc')
      const doubao = selectModel(current, models, 'doubao-realtime-duplex')
      return {
        value: { ...current, openaiRealtimeModel: openai?.id || '', doubaoRealtimeModel: doubao?.id || '' },
        capabilities: {
          openaiRealtime: Boolean(openai?.available),
          doubaoRealtime: Boolean(doubao?.available),
          doubaoRealtimeMissing: doubao && !doubao.available ? [doubao.missingCredential || 'DOUBAO_API_KEY'] : [],
          doubaoCredentialRefs: { apiKey: doubao?.missingCredential || 'DOUBAO_API_KEY' },
          openaiVoiceOptions: OPENAI_REALTIME_VOICES,
          realtimeModels: models.map(({ id, model, displayName, provider, source, protocol }) => ({ id, model, displayName, provider, source, protocol })),
        },
      }
    }

    scope.webServer.register({
      kind: 'exact', path: '/dsh-session-assistant/config',
      handler: async (req, res) => {
        if (req.method === 'GET') {
          sendJson(res, 200, { schema: Config.toJSON(), ...(await publicState()) })
          return
        }
        if (req.method === 'POST') {
          try {
            let body = ''
            let size = 0
            for await (const chunk of req) {
              size += Buffer.byteLength(chunk)
              if (size > MAX_SETTINGS_BYTES) throw new Error('settings payload is too large')
              body += chunk
            }
            const parsed = JSON.parse(body || '{}')
            settingsStore.write(normalize(parsed?.config))
            sendJson(res, 200, { ok: true, ...(await publicState()) })
          } catch (error) {
            sendJson(res, 400, { ok: false, error: String(error?.message || error) })
          }
          return
        }
        res.writeHead(405, { allow: 'GET, POST' })
        res.end()
      },
    })
  })
}
