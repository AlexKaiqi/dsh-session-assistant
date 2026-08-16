// DeepSeek Harness (dsh) plugin: ChatVoice — 免费的语音输入 + AI 回复朗读闭环。
// Free voice input + read-aloud for text-first dsh sessions.
//
//   - 语音输入: browser SpeechRecognition (Chrome=Google, Edge=Azure; 国内推荐 Edge)
//   - 朗读: browser speechSynthesis (Edge 的 Xiaoxiao Online (Natural) 中文最自然)
//   - 零 API key、零配置、零后端: 全部能力来自浏览器原生 Web Speech API
//
// Host 端只做两件事:
//   1. export Config (dsh web 设置页的 schema; 供表单渲染/校验)
//   2. webServer 路由 GET/POST /dsh-chatvoice/config —— 客户端读取/保存设置,
//      持久化到 ~/.dsh/chatvoice.json (保存即时生效, 无需重启, 与
//      dsh-free-vision 的已验证模式一致)
//
// 语音 UI 的全部 DOM 注入逻辑在 client/client.js (window.__ModuleLoader__
// 工厂格式, 由 package.json 的 dsh.client 声明加载)。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import z from '@deepseek-ai/schemastery'

/** Plugin config schema — the four settings rendered in the dsh web settings UI. */
export const Config = z.object({
  recognitionLang: z
    .union([z.const('zh-CN'), z.const('en-US')])
    .description('语音识别语言 / speech recognition language (zh-CN / en-US)')
    .default('zh-CN'),
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

export const name = 'dsh-chatvoice'
export const inject = []

/** Persistent settings file (written by the settings UI route). */
const CONFIG_PATH = homedir() + '/.dsh/chatvoice.json'

/** Read the persistent settings file; {} on any failure. */
function readSettingsFile() {
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
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
  if (out.recognitionLang !== 'zh-CN' && out.recognitionLang !== 'en-US') out.recognitionLang = 'zh-CN'
  if (typeof out.autoSpeak !== 'boolean') out.autoSpeak = false
  if (out.autoSpeakMode !== 'final' && out.autoSpeakMode !== 'all') out.autoSpeakMode = 'final'
  if (typeof out.voiceName !== 'string') out.voiceName = ''
  const r = Number(out.rate)
  out.rate = Number.isFinite(r) ? Math.min(2, Math.max(0.5, r)) : 1.0
  return out
}

export function apply(ctx, config = {}) {
  // Live config: cordis patch config merged with the persistent settings
  // file. Re-read on every request so a save from the settings page takes
  // effect without a restart.
  const getEffective = () => normalize(effectiveConfig(config))

  // dsh-market style: kind + path are how the host router matches routes.
  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], (scope) => {
      const sendJson = (res, status, body) => {
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(body))
      }
      scope.webServer.register({
        kind: 'exact',
        path: '/dsh-chatvoice/config',
        handler: async (req, res) => {
          if (req.method === 'GET') {
            sendJson(res, 200, { schema: Config.toJSON(), value: getEffective() })
            return
          }
          if (req.method === 'POST') {
            let body = ''
            for await (const chunk of req) body += chunk
            try {
              const parsed = JSON.parse(body || '{}')
              const next = parsed && parsed.config && typeof parsed.config === 'object' ? parsed.config : {}
              writeSettingsFile(normalize(next))
              sendJson(res, 200, { ok: true, value: getEffective() })
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
}

// Exported for unit tests (harmless to cordis).
export { CONFIG_PATH, effectiveConfig, normalize }
