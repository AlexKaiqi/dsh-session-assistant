import { randomUUID } from 'node:crypto'
import WebSocket, { WebSocketServer } from 'ws'

export const DOUBAO_DUPLEX_ENDPOINT = 'wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue'
export const DOUBAO_DUPLEX_MODEL = '1.2.6.0'
export const DOUBAO_INPUT_SAMPLE_RATE = 16_000
export const DOUBAO_OUTPUT_SAMPLE_RATE = 24_000

const MAX_CONTEXT_CHARS = 4_000
const MAX_AUDIO_BASE64_CHARS = 256 * 1024

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function boundedContext(value) {
  return typeof value === 'string'
    ? value.replaceAll('\0', '').trim().slice(0, MAX_CONTEXT_CHARS)
    : ''
}

/** Same-origin browser upgrades only: another web page must not be able to spend the user's speech quota. */
export function isSameOriginUpgrade(req) {
  const origin = String(req.headers?.origin || '')
  const host = String(req.headers?.host || '')
  if (!origin || !host) return false
  try {
    const parsed = new URL(origin)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.host === host
  } catch {
    return false
  }
}

export function rejectUpgrade(socket, status = '403 Forbidden', message = 'forbidden') {
  const bytes = Buffer.byteLength(message)
  socket.end([
    `HTTP/1.1 ${status}`,
    'Connection: close',
    'Content-Type: text/plain; charset=utf-8',
    `Content-Length: ${bytes}`,
    '',
    message,
  ].join('\r\n'))
}

export function doubaoDraftTool() {
  return {
    type: 'function',
    name: 'update_working_draft',
    description: 'Apply an intentional change to the editable working draft. Do not call this for discussion that leaves the draft unchanged.',
    strict: true,
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
          description: 'A short description of what changed. This is not the spoken reply.',
        },
        status: {
          type: 'string',
          enum: ['drafting', 'ready'],
          description: 'Use ready only after finalization or explicit acceptance.',
        },
      },
      required: ['draft', 'summary', 'status'],
    },
  }
}

export function buildDoubaoDuplexSession(model, instructions, id = randomUUID()) {
  return {
    session: {
      id,
      model: String(model || DOUBAO_DUPLEX_MODEL),
      instructions: String(instructions || ''),
      audio: {
        input: { format: { type: 'pcm', rate: DOUBAO_INPUT_SAMPLE_RATE } },
        output: {
          format: { type: 'pcm_s16le', rate: DOUBAO_OUTPUT_SAMPLE_RATE },
          voice: 'zh_female_vv_jupiter_bigtts',
        },
      },
      tools: [doubaoDraftTool()],
    },
  }
}

function localError(socket, message, details = {}) {
  if (socket.readyState !== WebSocket.OPEN) return
  socket.send(JSON.stringify({
    type: 'error',
    error: { message: String(message || 'Doubao Realtime error'), ...details },
  }))
}

function parseLocalMessage(data, isBinary) {
  if (isBinary) throw new Error('ChatVoice Doubao transport accepts JSON text frames only')
  const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data)
  if (Buffer.byteLength(text, 'utf8') > 512 * 1024) throw new Error('ChatVoice Realtime frame is too large')
  const parsed = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid ChatVoice Realtime event')
  return parsed
}

function functionResultEvent(message) {
  const callID = String(message.call_id || '')
  const output = String(message.output || '')
  if (!callID || callID.length > 240 || output.length > 64_000) throw new Error('invalid draft tool result')
  return {
    type: 'conversation.item.create',
    event_id: randomUUID(),
    items: [{
      call_id: callID,
      role: 'tool',
      content: [{ type: 'input_text', text: output }],
    }],
  }
}

function safeUpstreamEvent(message, sessionState) {
  switch (message.type) {
    case 'input_audio_buffer.append': {
      const audio = String(message.audio || '')
      if (!audio || audio.length > MAX_AUDIO_BASE64_CHARS || !/^[A-Za-z0-9+/]+={0,2}$/.test(audio)) {
        throw new Error('invalid or oversized PCM audio packet')
      }
      return { type: message.type, event_id: randomUUID(), audio }
    }
    case 'input_audio_buffer.commit':
    case 'response.cancel':
      return { type: message.type, event_id: randomUUID() }
    case 'tool.result':
      return functionResultEvent(message)
    case 'context.update': {
      const context = boundedContext(message.context)
      const next = buildDoubaoDuplexSession(sessionState.model, sessionState.instructions(context), sessionState.id)
      return { type: 'session.update', event_id: randomUUID(), ...next }
    }
    case 'session.close':
      return { type: 'session.close', event_id: randomUUID() }
    default:
      throw new Error(`unsupported ChatVoice Realtime event: ${String(message.type || '')}`)
  }
}

/** Open and initialize one short-lived upstream session to verify credentials and model access. */
export function probeDoubaoDuplex({ endpoint, appId, apiKey, model }, timeoutMs = 20_000) {
  return new Promise((resolve, reject) => {
    const started = performance.now()
    const upstream = new WebSocket(String(endpoint || DOUBAO_DUPLEX_ENDPOINT), {
      headers: {
        'X-Api-App-Id': String(appId || ''),
        'X-Api-Key': String(apiKey || ''),
      },
      handshakeTimeout: timeoutMs,
    })
    let settled = false
    const finish = (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) upstream.close()
      if (error) reject(error)
      else resolve({ latencyMs: Math.round(performance.now() - started) })
    }
    const timer = setTimeout(() => finish(new Error('豆包 Realtime 连接测试超时')), timeoutMs)
    upstream.on('open', () => {
      const session = buildDoubaoDuplexSession(model, 'Connection test. Do not produce a response.')
      upstream.send(JSON.stringify({ type: 'session.create', event_id: randomUUID(), ...session }))
    })
    upstream.on('message', (payload, binary) => {
      if (binary) {
        finish(new Error('豆包 Realtime 连接测试收到意外二进制响应'))
        return
      }
      let event
      try { event = JSON.parse(Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload)) } catch { event = null }
      if (event?.type === 'session.created') finish()
      if (event?.type === 'error') finish(new Error(String(event.error?.message || '豆包 Realtime 拒绝了会话')))
    })
    upstream.on('unexpected-response', (_request, response) => finish(new Error(`豆包 Realtime 鉴权失败：HTTP ${response.statusCode || 'unknown'}`)))
    upstream.on('error', (error) => finish(new Error(`豆包 Realtime 连接失败：${error?.message || error}`)))
    upstream.on('close', (code, reason) => {
      if (!settled) finish(new Error(`豆包 Realtime 在完成测试前关闭：${reason?.toString() || `code ${code}`}`))
    })
  })
}

/**
 * Register a secret-owning, same-origin WebSocket bridge to Doubao Realtime Duplex.
 * The browser may send audio and tool results but can never choose credentials,
 * endpoint, model instructions, or arbitrary upstream event shapes.
 */
export function registerDoubaoDuplexUpgrade(scope, options) {
  const acceptor = new WebSocketServer({ noServer: true })
  const disposeRoute = scope.webServer.registerUpgrade({
    path: '/dsh-chatvoice/realtime/doubao',
    handler(req, socket, head) {
      if (!isSameOriginUpgrade(req)) {
        rejectUpgrade(socket)
        return
      }
      acceptor.handleUpgrade(req, socket, head, (browser) => {
        let upstream
        let starting = false
        let started = false
        let sessionState

        const closeBoth = (code = 1000, reason = 'closed') => {
          if (upstream && (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING)) {
            try { upstream.close(code, reason.slice(0, 120)) } catch { upstream.terminate() }
          }
          if (browser.readyState === WebSocket.OPEN) browser.close(code, reason.slice(0, 120))
        }

        browser.on('message', async (data, isBinary) => {
          let message
          try {
            message = parseLocalMessage(data, isBinary)
          } catch (error) {
            localError(browser, error?.message || error)
            return
          }

          if (!started) {
            if (starting || message.type !== 'session.start') {
              localError(browser, starting ? 'Doubao Realtime session is still starting' : 'first event must be session.start')
              return
            }
            starting = true
            try {
              const route = await options.selectRoute()
              if (!route) throw new Error('模型注册表中没有豆包 Realtime Duplex 路由')
              const credential = await options.resolveCredentials(route)
              if (!credential?.appId) throw new Error(`DSH host 未配置 ${credential?.appIdRef || 'DOUBAO_APPID'}`)
              if (!credential?.apiKey) throw new Error(`DSH host 未配置 ${credential?.apiKeyRef || 'DOUBAO_REALTIME_API_KEY'}`)
              const context = boundedContext(message.context)
              sessionState = {
                id: randomUUID(),
                model: route.model || DOUBAO_DUPLEX_MODEL,
                instructions: options.instructions,
              }
              const endpoint = String(route.endpoint || DOUBAO_DUPLEX_ENDPOINT)
              upstream = new WebSocket(endpoint, {
                headers: {
                  'X-Api-App-Id': credential.appId,
                  'X-Api-Key': credential.apiKey,
                },
                handshakeTimeout: 20_000,
              })
              upstream.on('open', () => {
                const config = buildDoubaoDuplexSession(
                  sessionState.model,
                  sessionState.instructions(context),
                  sessionState.id,
                )
                upstream.send(JSON.stringify({ type: 'session.create', event_id: randomUUID(), ...config }))
              })
              upstream.on('message', (payload, binary) => {
                if (browser.readyState !== WebSocket.OPEN) return
                if (binary) {
                  localError(browser, 'Doubao Duplex returned an unexpected binary frame')
                  return
                }
                const text = Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload)
                let event
                try { event = JSON.parse(text) } catch { event = null }
                if (event?.type === 'session.created') {
                  started = true
                  starting = false
                  sessionState.id = String(event.session?.id || sessionState.id)
                }
                browser.send(text)
              })
              upstream.on('error', (error) => {
                localError(browser, `豆包 Realtime 初始化失败：${error?.message || error}`)
              })
              upstream.on('unexpected-response', (_request, response) => {
                localError(browser, `豆包 Realtime 初始化失败：HTTP ${response.statusCode || 'unknown'}`)
              })
              upstream.on('close', (code, reason) => {
                const detail = reason?.toString() || `code ${code}`
                if (browser.readyState === WebSocket.OPEN) {
                  localError(browser, `豆包 Realtime 连接已关闭：${detail}`, { code })
                  browser.close(code === 1000 ? 1000 : 1011, 'Doubao upstream closed')
                }
              })
            } catch (error) {
              starting = false
              localError(browser, error?.message || error)
            }
            return
          }

          if (!upstream || upstream.readyState !== WebSocket.OPEN) {
            localError(browser, 'Doubao Realtime upstream is not connected')
            return
          }
          try {
            const outgoing = safeUpstreamEvent(message, sessionState)
            upstream.send(JSON.stringify(outgoing))
          } catch (error) {
            localError(browser, error?.message || error)
          }
        })

        browser.on('close', () => closeBoth())
        browser.on('error', () => closeBoth(1011, 'browser websocket error'))
      })
    },
  })

  if (typeof scope.effect === 'function') {
    scope.effect(() => () => {
      for (const socket of acceptor.clients) socket.terminate()
      acceptor.close()
      disposeRoute()
    }, 'dsh-chatvoice.doubao-realtime')
  }
  return { acceptor, disposeRoute }
}

export { boundedContext, functionResultEvent, parseLocalMessage, safeUpstreamEvent }
