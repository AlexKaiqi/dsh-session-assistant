// DeepSeek Harness (dsh) plugin: Talk to Text — 语音输入 + AI 回复朗读闭环。
// Voice input + read-aloud for text-first dsh sessions.
//
//   - 语音输入: browser SpeechRecognition，或注册的 GPT Realtime 思考/草稿工作台
//   - 朗读: browser speechSynthesis (Edge 的 Xiaoxiao Online (Natural) 中文最自然)
//   - Realtime 模型、Base URL 和凭据引用从 DSH 模型注册设置解析；长期 Key 不下发浏览器
//
// Host 端做三件事:
//   1. export Config (dsh web 设置页的 schema; 供表单渲染/校验)
//   2. webServer 路由 GET/POST /dsh-talk-to-text/config —— 客户端读取/保存设置,
//      持久化到 ~/.dsh/talk-to-text.json (保存即时生效, 无需重启, 与
//      dsh-free-vision 的已验证模式一致)
//   3. 使用模型页注册路由的凭据初始化 Realtime WebRTC 讨论与草稿会话
//
// 语音 UI 的全部 DOM 注入逻辑在 client/client.js (window.__ModuleLoader__
// 工厂格式, 由 package.json 的 dsh.client 声明加载)。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import z from '@deepseek-ai/schemastery'
import {
  DOUBAO_DUPLEX_ENDPOINT,
  probeDoubaoDuplex,
  registerDoubaoDuplexUpgrade,
} from './doubao.js'

/** Plugin config schema — settings rendered in the dsh web settings UI. */
export const Config = z.object({
  recognitionProvider: z
    .union([z.const('browser'), z.const('openai-realtime'), z.const('doubao-realtime')])
    .description('语音后端 / browser Web Speech, OpenAI Realtime, or Doubao Realtime Duplex')
    .default('doubao-realtime'),
  recognitionLang: z
    .union([z.const('zh-CN'), z.const('en-US')])
    .description('语音识别语言 / speech recognition language (zh-CN / en-US)')
    .default('zh-CN'),
  openaiRealtimeModel: z
    .string()
    .description('模型注册表中的 GPT Realtime 路由；留空自动选择第一个')
    .default(''),
  doubaoRealtimeModel: z
    .string()
    .description('模型注册表中的豆包 Realtime Duplex 路由；留空自动选择第一个')
    .default(''),
  openaiContextMode: z
    .union([z.const('off'), z.const('draft'), z.const('recent')])
    .description('Realtime 共同思考上下文 / off, current draft, or draft + recent visible conversation')
    .default('recent'),
  autoSpeak: z
    .boolean()
    .description('自动朗读新回复（可点小喇叭随时停止）/ auto read new replies')
    .default(false),
  autoSpeakMode: z
    .union([z.const('final'), z.const('all')])
    .description('自动朗读范围 / auto-read scope: final = 只读最终结论（跳过思维链）, all = 全部朗读（思维链+结论）')
    .default('final'),
  voiceName: z
    .string()
    .description('朗读音色名，留空自动选最佳中文音色（Edge: Xiaoxiao Online (Natural)）/ voice name; empty = auto pick')
    .default(''),
  rate: z
    .number()
    .description('朗读语速 0.5~2 / speech rate (0.5 - 2)')
    .default(1.0),
})

export const name = 'dsh-talk-to-text'
export const inject = []

/** Persistent settings file (written by the settings UI route). */
const CONFIG_PATH = homedir() + '/.dsh/talk-to-text.json'
const LEGACY_CONFIG_PATH = homedir() + '/.dsh/chatvoice.json'

/** Read current settings, falling back to the pre-rename location once. */
function readSettingsFile() {
  for (const path of [CONFIG_PATH, LEGACY_CONFIG_PATH]) {
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf-8'))
      if (parsed && typeof parsed === 'object') return parsed
    } catch {
      // Try the legacy path, then fall back to defaults.
    }
  }
  return {}
}

/** Persist settings (server side, called from the web UI route). */
function writeSettingsFile(next) {
  mkdirSync(homedir() + '/.dsh', { recursive: true })
  writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf-8')
}

/** Merge order: cordis patch config < persistent settings file. */
function effectiveConfig(baseConfig) {
  return { ...baseConfig, ...readSettingsFile() }
}

/** Clamp/whitelist incoming values so the client never sees a bad config. */
function normalize(next) {
  const out = { ...(next || {}) }
  delete out.openaiRealtimeAvailable
  delete out.doubaoRealtimeAvailable
  delete out.realtimeModels
  if (!['browser', 'openai-realtime', 'doubao-realtime'].includes(out.recognitionProvider)) out.recognitionProvider = 'doubao-realtime'
  if (out.recognitionLang !== 'zh-CN' && out.recognitionLang !== 'en-US') out.recognitionLang = 'zh-CN'
  if (typeof out.openaiRealtimeModel !== 'string' || !/^[A-Za-z0-9._:/-]{0,180}$/.test(out.openaiRealtimeModel)) {
    out.openaiRealtimeModel = ''
  }
  if (typeof out.doubaoRealtimeModel !== 'string' || !/^[A-Za-z0-9._:/-]{0,180}$/.test(out.doubaoRealtimeModel)) {
    out.doubaoRealtimeModel = ''
  }
  if (out.openaiContextMode !== 'off' && out.openaiContextMode !== 'draft' && out.openaiContextMode !== 'recent') {
    out.openaiContextMode = 'recent'
  }
  if (typeof out.autoSpeak !== 'boolean') out.autoSpeak = false
  if (out.autoSpeakMode !== 'final' && out.autoSpeakMode !== 'all') out.autoSpeakMode = 'final'
  if (typeof out.voiceName !== 'string') out.voiceName = ''
  const r = Number(out.rate)
  out.rate = Number.isFinite(r) ? Math.min(2, Math.max(0.5, r)) : 1.0
  return out
}

/** Build the server-owned configuration sent through the Realtime unified WebRTC interface. */
function normalizeTranscriptionContext(value) {
  if (typeof value !== 'string') return ''
  return value.replaceAll('\0', '').trim().slice(0, 4_000)
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function registeredRealtimeModels(descriptors = []) {
  const routes = []
  const seen = new Set()
  const add = (route) => {
    if (!route.id || !route.model || seen.has(route.id)) return
    seen.add(route.id)
    routes.push(route)
  }

  const multi = descriptors.find((entry) => String(entry?.ns || '') === 'multi-model-provider')
  const taskRoot = object(multi?.value)
  const connections = object(taskRoot.connections)
  for (const [id, raw] of Object.entries(object(taskRoot.models))) {
    const model = object(raw)
    const connection = object(connections[model.connection])
    const capabilities = Array.isArray(model.capabilities) ? model.capabilities : []
    const provider = String(connection.provider || '')
    const profile = object(model.profile)
    const credentialRefs = object(connection.credentialRefs)
    const protocol = String(profile.protocol || model.runtimeAdapter || '')
    const isDoubao = protocol === 'doubao-realtime-duplex'
    const configuredModels = Array.isArray(connection.models) ? connection.models.map(object) : []
    const selectedByProvider = isDoubao && configuredModels.some(candidate => {
      const candidateID = String(candidate.id || '')
      return candidateID === String(profile.voice || '') || candidateID === id
    })
    if (model.enabled === false && !selectedByProvider) continue
    if (model.task !== 'realtime-speech' && !capabilities.includes('speech.realtime_session')) continue
    if (provider !== 'openai' && !isDoubao) continue
    add({
      id,
      model: String(model.model || ''),
      displayName: String(model.displayName || model.model || id),
      provider,
      source: 'task-model',
      baseURL: String(connection.baseURL || 'https://api.openai.com/v1'),
      credentialRef: String(connection.credentialRef || 'OPENAI_API_KEY'),
      credentialRefs,
      protocol: isDoubao ? 'doubao-realtime-duplex' : 'openai-webrtc',
      endpoint: String(profile.endpoint || (isDoubao ? DOUBAO_DUPLEX_ENDPOINT : '')),
      voice: String(profile.voice || ''),
      variant: String(profile.variant || ''),
    })
  }

  const llm = descriptors.find((entry) => String(entry?.ns || '') === 'llm-pi-ai')
  for (const [provider, raw] of Object.entries(object(object(llm?.value).providers))) {
    const profile = object(raw)
    for (const rawModel of Array.isArray(profile.models) ? profile.models : []) {
      const model = object(rawModel)
      const modelId = String(model.id || '')
      if (!/^gpt-(?:4o(?:-mini)?-)?realtime(?:-|$)/.test(modelId)) continue
      add({
        id: `llm:${provider}/${modelId}`,
        model: modelId,
        displayName: String(model.name || modelId),
        provider: String(provider),
        source: 'llm-registry',
        baseURL: String(profile.baseURL || 'https://api.openai.com/v1'),
        credentialRef: String(profile.apiKeyEnv || 'OPENAI_API_KEY'),
        protocol: 'openai-webrtc',
      })
    }
  }
  return routes
}

async function discoverRealtimeModels(scope) {
  const descriptors = scope.settings.describe({ redactSecrets: true })
  const routes = registeredRealtimeModels(descriptors)
  const seen = new Set(routes.map((route) => route.id))
  const llm = descriptors.find((entry) => String(entry?.ns || '') === 'llm-pi-ai')
  const profiles = object(object(llm?.value).providers)

  for (const providerInfo of scope.llm.listProviders()) {
    const provider = String(providerInfo?.id || '')
    if (!provider) continue
    let models
    try {
      models = await scope.llm.listModels(provider)
    } catch {
      continue
    }
    const profile = object(profiles[provider])
    for (const rawModel of Array.isArray(models) ? models : []) {
      const model = object(rawModel)
      const modelId = String(model.id || '')
      const id = `llm:${provider}/${modelId}`
      if (!/^gpt-(?:4o(?:-mini)?-)?realtime(?:-|$)/.test(modelId) || seen.has(id)) continue
      seen.add(id)
      routes.push({
        id,
        model: modelId,
        displayName: String(model.name || modelId),
        provider,
        source: 'llm-registry',
        baseURL: String(profile.baseURL || 'https://api.openai.com/v1'),
        credentialRef: String(profile.apiKeyEnv || 'OPENAI_API_KEY'),
        protocol: 'openai-webrtc',
      })
    }
  }
  return routes
}

function selectRealtimeModel(config, models, backend = 'openai') {
  const providerModels = models.filter((model) => backend === 'doubao'
    ? model.protocol === 'doubao-realtime-duplex'
    : model.protocol !== 'doubao-realtime-duplex')
  const selected = String(backend === 'doubao' ? config.doubaoRealtimeModel : config.openaiRealtimeModel || '')
  return providerModels.find((model) => model.id === selected)
    || providerModels.find((model) => model.model === selected)
    || providerModels[0]
}

const VOICE_WORKSPACE_TOOL = 'update_working_draft'

function voiceWorkspaceTool() {
  return {
    type: 'function',
    name: VOICE_WORKSPACE_TOOL,
    description: 'Apply an intentional change to the editable working draft. Do not call this for conversation that leaves the draft unchanged.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        draft: {
          type: 'string',
          description: 'The complete new working draft after applying the requested or agreed change.',
        },
        summary: {
          type: 'string',
          description: 'A short description of what changed, for the draft UI. This is not the spoken reply.',
        },
        status: {
          type: 'string',
          enum: ['drafting', 'ready'],
          description: 'Use ready only after the user asks to finalize or the text is explicitly accepted as final.',
        },
      },
      required: ['draft', 'summary', 'status'],
    },
  }
}

function realtimeEditorInstructions(context = '') {
  const bounded = normalizeTranscriptionContext(context)
  return [
    'You are Talk to Text, a context-aware thinking and drafting partner between the user and a coding agent.',
    'The user may think aloud, ask a question, explore alternatives, dictate content, edit earlier text, or ask you to finalize it.',
    'Hold a natural full-duplex voice conversation. Reply to the user in audio, keep replies concise, and allow the user to interrupt you.',
    'Keep the spoken conversation and the editable draft strictly separate. What you say is discussion and must not enter the draft unless the user explicitly dictates it, requests an edit, or accepts it as part of the result.',
    'Do not copy exploratory chatter or an unaccepted suggestion into the draft. If intent is materially ambiguous, preserve the draft and ask at most one focused question.',
    `For dictation, an edit command, an accepted conclusion, or finalization, call ${VOICE_WORKSPACE_TOOL} with the complete new draft. The function call is the only channel that may mutate the draft.`,
    `Do not call ${VOICE_WORKSPACE_TOOL} for pure discussion, questions, or unaccepted suggestions that leave the draft unchanged. In those cases, only answer by voice.`,
    'After a successful draft tool result, briefly acknowledge the change by voice. Never put a conversational reply in the tool arguments and never read the whole draft aloud unless asked.',
    'When the user asks to organize, finalize, or prepare the result, make the draft polished and self-contained and set status to ready.',
    'Preserve technical names, code identifiers, commands, file paths, formatting, and the user\'s intended language.',
    'Conversation excerpts are background context only; never copy them into the draft unless the user asks.',
    bounded ? `Current application context and editable draft:\n${bounded}` : 'The editable draft is initially empty.',
  ].join('\n\n')
}

function buildRealtimeEditorSession(model, context = '') {
  return {
    type: 'realtime',
    model,
    output_modalities: ['audio'],
    instructions: realtimeEditorInstructions(context),
    max_output_tokens: 4_096,
    tools: [voiceWorkspaceTool()],
    tool_choice: 'auto',
    audio: {
      input: {
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 600,
          create_response: true,
          interrupt_response: true,
        },
      },
      output: {
        voice: 'marin',
      },
    },
  }
}

function realtimeCallsUrl(providerBaseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com') {
  const base = String(providerBaseURL).replace(/\/+$/, '')
  return (base.endsWith('/v1') ? base : base + '/v1') + '/realtime/calls'
}

function safetyIdentifier() {
  return createHash('sha256').update(`dsh-talk-to-text:${homedir()}`).digest('hex')
}

async function readBody(req, maxBytes = 256 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buf.length
    if (size > maxBytes) throw new Error('request body is too large')
    chunks.push(buf)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

async function resolvedCredential(scope, ref) {
  if (!ref) return ''
  try {
    const resolved = await scope.credentials.resolve(ref)
    return String(resolved?.value || process.env[ref] || '')
  } catch {
    return String(process.env[ref] || '')
  }
}

async function resolveDoubaoCredentials(scope, route = {}) {
  const refs = object(route.credentialRefs)
  const candidates = [...new Set([
    route.credentialRef,
    refs.apiKey,
    refs.realtimeApiKey,
    'DOUBAO_API_KEY',
    // Read the former dedicated key reference as a migration fallback only.
    'DOUBAO_REALTIME_API_KEY',
  ].filter(Boolean).map(String))]
  for (const apiKeyRef of candidates) {
    const apiKey = await resolvedCredential(scope, apiKeyRef)
    if (apiKey) return { apiKey, apiKeyRef }
  }
  return { apiKey: '', apiKeyRef: String(route.credentialRef || refs.apiKey || refs.realtimeApiKey || 'DOUBAO_API_KEY') }
}

async function selectDraftFinalizeModel(scope) {
  for (const providerInfo of scope.llm.listProviders()) {
    const provider = String(providerInfo?.id || '')
    if (!provider) continue
    let models
    try { models = await scope.llm.listModels(provider) } catch { continue }
    const selected = (Array.isArray(models) ? models : []).find((entry) => {
      const id = String(entry?.id || '')
      const inputs = Array.isArray(entry?.inputModalities) ? entry.inputModalities : ['text']
      return id && !/realtime/i.test(id) && inputs.includes('text')
    })
    if (selected) return { provider, model: String(selected.id), displayName: String(selected.name || selected.id) }
  }
}

async function generateFinalDraft(scope, context, draft) {
  const route = await selectDraftFinalizeModel(scope)
  if (!route) throw new Error('模型注册表中没有可用于整理草稿的文本模型')
  const framed = JSON.stringify({
    applicationContext: normalizeTranscriptionContext(context),
    currentDraft: normalizeTranscriptionContext(draft),
  })
  const messages = [{
    id: randomUUID(),
    role: 'user',
    source: { kind: 'plugin', plugin: 'dsh-talk-to-text' },
    content: [{ type: 'text', text: `Finalize the working draft from this JSON input:\n${framed}` }],
  }]
  const signal = AbortSignal.timeout(45_000)
  let text = ''
  let failure
  for await (const chunk of scope.llm.stream({
    provider: route.provider,
    model: route.model,
    messages,
    system: [
      'You finalize an editable draft after a voice deliberation.',
      'Return only the mature, self-contained final draft in the user\'s language.',
      'Preserve confirmed constraints, technical names, code, paths, and formatting.',
      'Do not add commentary, quotes, a preface, or Markdown fences around the whole result.',
    ].join('\n'),
    maxTokens: 4_096,
    signal,
  })) {
    if (chunk.type === 'text-delta') text += String(chunk.text || '')
    if (chunk.type === 'finish' && (chunk.reason?.kind === 'error' || chunk.reason?.kind === 'aborted')) {
      failure = chunk.reason.failure?.message || '草稿整理模型调用失败'
    }
  }
  if (failure) throw new Error(failure)
  const cleaned = text.trim().replace(/^```(?:text|markdown)?\s*\n([\s\S]*?)\n```$/i, '$1').trim()
  if (!cleaned) throw new Error('草稿整理模型没有返回文本')
  return { draft: cleaned, model: route }
}

export function apply(ctx, config = {}) {
  // Live config: cordis patch config merged with the persistent settings
  // file. Re-read on every request so a save from the settings page takes
  // effect without a restart.
  const getEffective = () => normalize(effectiveConfig(config))

  // dsh-market style: kind + path are how the host router matches routes.
  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer', 'settings', 'credentials', 'llm'], (scope) => {
      const sendJson = (res, status, body) => {
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(body))
      }
      const publicState = async () => {
        const models = await discoverRealtimeModels(scope)
        const selectedOpenAI = selectRealtimeModel(getEffective(), models, 'openai')
        const selectedDoubao = selectRealtimeModel(getEffective(), models, 'doubao')
        let openaiCredentialReady = false
        if (selectedOpenAI) {
          openaiCredentialReady = Boolean(await resolvedCredential(scope, selectedOpenAI.credentialRef))
        }
        const doubaoCredential = selectedDoubao
          ? await resolveDoubaoCredentials(scope, selectedDoubao)
          : undefined
        const doubaoMissing = []
        if (selectedDoubao && !doubaoCredential?.apiKey) doubaoMissing.push(doubaoCredential?.apiKeyRef || 'DOUBAO_API_KEY')
        return {
          value: {
            ...getEffective(),
            openaiRealtimeModel: selectedOpenAI?.id || '',
            doubaoRealtimeModel: selectedDoubao?.id || '',
          },
          capabilities: {
            openaiRealtime: Boolean(selectedOpenAI && openaiCredentialReady),
            doubaoRealtime: Boolean(selectedDoubao && doubaoCredential?.apiKey),
            doubaoRealtimeMissing: doubaoMissing,
            doubaoCredentialRefs: {
              apiKey: doubaoCredential?.apiKeyRef || 'DOUBAO_API_KEY',
            },
            realtimeModels: models.map(({ id, model, displayName, provider, source, protocol }) => ({
              id, model, displayName, provider, source, protocol,
            })),
          },
        }
      }

      if (typeof scope.webServer.registerUpgrade === 'function') {
        registerDoubaoDuplexUpgrade(scope, {
          selectRoute: async () => {
            const models = await discoverRealtimeModels(scope)
            return selectRealtimeModel(getEffective(), models, 'doubao')
          },
          resolveCredentials: (route) => resolveDoubaoCredentials(scope, route),
          instructions: realtimeEditorInstructions,
        })
      }
      scope.webServer.register({
        kind: 'exact',
        path: '/dsh-talk-to-text/config',
        handler: async (req, res) => {
          if (req.method === 'GET') {
            const state = await publicState()
            sendJson(res, 200, { schema: Config.toJSON(), ...state })
            return
          }
          if (req.method === 'POST') {
            let body = ''
            for await (const chunk of req) body += chunk
            try {
              const parsed = JSON.parse(body || '{}')
              const next = parsed && parsed.config && typeof parsed.config === 'object' ? parsed.config : {}
              writeSettingsFile(normalize(next))
              const state = await publicState()
              sendJson(res, 200, { ok: true, ...state })
            } catch (error) {
              sendJson(res, 400, { ok: false, error: String(error?.message || error) })
            }
            return
          }
          res.writeHead(405, { allow: 'GET, POST' })
          res.end()
        },
      })
      scope.webServer.register({
        kind: 'exact',
        path: '/dsh-talk-to-text/realtime/doubao/probe',
        handler: async (req, res) => {
          if (req.method !== 'POST') {
            res.writeHead(405, { allow: 'POST' })
            res.end()
            return
          }
          if (req.headers['x-dsh-model-probe'] !== '1') {
            sendJson(res, 403, { ok: false, error: 'missing model probe request marker' })
            return
          }
          try {
            const models = await discoverRealtimeModels(scope)
            const selected = selectRealtimeModel(getEffective(), models, 'doubao')
            if (!selected) throw new Error('模型注册表中没有已启用的豆包 Realtime Duplex 路由')
            const credential = await resolveDoubaoCredentials(scope, selected)
            if (!credential?.apiKey) throw new Error(`未配置 ${credential?.apiKeyRef || 'DOUBAO_API_KEY'}`)
            const result = await probeDoubaoDuplex({
              endpoint: selected.endpoint,
              model: selected.model,
              voice: selected.voice,
              apiKey: credential.apiKey,
            })
            sendJson(res, 200, { ok: true, observedAt: new Date().toISOString(), ...result })
          } catch (error) {
            sendJson(res, 502, { ok: false, error: String(error?.message || error) })
          }
        },
      })
      scope.webServer.register({
        kind: 'exact',
        path: '/dsh-talk-to-text/draft/finalize',
        handler: async (req, res) => {
          if (req.method !== 'POST') {
            res.writeHead(405, { allow: 'POST' })
            res.end()
            return
          }
          if (req.headers['x-dsh-talk-to-text'] !== '1') {
            sendJson(res, 403, { ok: false, error: 'missing Talk to Text request marker' })
            return
          }
          try {
            const parsed = JSON.parse(await readBody(req, 32 * 1024) || '{}')
            const result = await generateFinalDraft(scope, parsed.context, parsed.draft)
            sendJson(res, 200, { ok: true, draft: result.draft, model: result.model })
          } catch (error) {
            sendJson(res, 502, { ok: false, error: String(error?.message || error) })
          }
        },
      })
      scope.webServer.register({
        kind: 'exact',
        path: '/dsh-talk-to-text/realtime/session',
        handler: async (req, res) => {
          if (req.method !== 'POST') {
            res.writeHead(405, { allow: 'POST' })
            res.end()
            return
          }
          if (req.headers['x-dsh-talk-to-text'] !== '1') {
            sendJson(res, 403, { ok: false, error: 'missing Talk to Text request marker' })
            return
          }
          const models = await discoverRealtimeModels(scope)
          const selected = selectRealtimeModel(getEffective(), models, 'openai')
          if (!selected) {
            sendJson(res, 503, { ok: false, error: '模型注册表中没有可用的 GPT Realtime 模型' })
            return
          }
          const credential = await scope.credentials.resolve(selected.credentialRef)
          const apiKey = credential?.value || process.env[selected.credentialRef]
          if (!apiKey) {
            sendJson(res, 503, { ok: false, error: `DSH host 未配置 ${selected.credentialRef}` })
            return
          }
          try {
            const rawBody = await readBody(req)
            let sdp = rawBody
            let context = ''
            if (String(req.headers['content-type'] || '').startsWith('application/json')) {
              const parsed = JSON.parse(rawBody || '{}')
              sdp = typeof parsed.sdp === 'string' ? parsed.sdp : ''
              context = normalizeTranscriptionContext(parsed.context)
            }
            if (!sdp.trim() || !sdp.startsWith('v=0')) {
              sendJson(res, 400, { ok: false, error: 'invalid SDP offer' })
              return
            }
            const fd = new FormData()
            fd.set('sdp', sdp)
            fd.set('session', JSON.stringify(buildRealtimeEditorSession(selected.model, context)))
            const upstream = await fetch(realtimeCallsUrl(selected.baseURL), {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'OpenAI-Safety-Identifier': safetyIdentifier(),
              },
              body: fd,
              signal: AbortSignal.timeout(20_000),
            })
            const answer = await upstream.text()
            if (!upstream.ok) {
              let detail = answer.slice(0, 800)
              try { detail = JSON.parse(answer)?.error?.message || detail } catch { /* plain-text upstream error */ }
              sendJson(res, upstream.status, { ok: false, error: `OpenAI Realtime 初始化失败：${detail}` })
              return
            }
            res.writeHead(200, { 'Content-Type': 'application/sdp' })
            res.end(answer)
          } catch (error) {
            const message = error?.name === 'TimeoutError'
              ? 'OpenAI Realtime 初始化超时'
              : String(error?.message || error)
            sendJson(res, 502, { ok: false, error: message })
          }
        },
      })
    })
  }
}

// Exported for unit tests (harmless to cordis).
export {
  CONFIG_PATH, buildRealtimeEditorSession, effectiveConfig, normalize,
  normalizeTranscriptionContext, realtimeCallsUrl, realtimeEditorInstructions,
  discoverRealtimeModels, registeredRealtimeModels, selectRealtimeModel,
  voiceWorkspaceTool,
}
