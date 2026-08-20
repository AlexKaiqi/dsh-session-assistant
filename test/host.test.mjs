import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Readable } from 'node:stream'
import test from 'node:test'

import {
  apply,
  buildRealtimeEditorSession,
  discoverRealtimeModels,
  normalize,
  normalizeTranscriptionContext,
  registeredRealtimeModels,
  realtimeCallsUrl,
  realtimeEditorInstructions,
  submitToAgentTool,
  voiceWorkspaceTool,
  voiceWorkspaceTools,
} from '../dsh/index.js'
import {
  buildDoubaoDuplexSession,
  doubaoVoiceTools,
  functionResultEvent,
  isSameOriginUpgrade,
  safeUpstreamEvent,
} from '../dsh/doubao.js'

function descriptors(models = [{ id: 'gpt-realtime-2.1', name: 'GPT Realtime 2.1' }]) {
  return [{
    ns: 'llm-pi-ai',
    value: {
      providers: {
        openai: {
          baseURL: 'https://example.test/v1',
          apiKeyEnv: 'OPENAI_API_KEY',
          models,
        },
      },
    },
  }]
}

function captureRoutes(config = {}, options = {}) {
  const routes = []
  apply({
    inject(_deps, callback) {
      callback({
        webServer: { register(route) { routes.push(route) } },
        settings: { describe() { return options.descriptors ?? descriptors() } },
        credentials: options.credentials ?? {
          async resolve() { return options.credential ?? { value: 'test-server-key' } },
          async set() {},
        },
        llm: options.llm ?? {
          listProviders() { return [{ id: 'openai', name: 'OpenAI' }] },
          async listModels() { return [{ id: 'gpt-realtime-2.1', name: 'GPT Realtime 2.1' }] },
        },
      })
    },
  }, config)
  return routes
}

function request(body, headers = {}) {
  const req = Readable.from([body])
  req.method = 'POST'
  req.headers = headers
  return req
}

function response() {
  return {
    status: 0,
    headers: {},
    body: '',
    writeHead(status, headers = {}) {
      this.status = status
      this.headers = headers
    },
    end(chunk = '') {
      this.body += String(chunk)
    },
  }
}

test('normalizes Realtime settings without persisting host capability state', () => {
  assert.deepEqual(normalize({
    recognitionProvider: 'openai-realtime',
    recognitionLang: 'en-US',
    openaiRealtimeModel: 'llm:openai/gpt-realtime-2.1',
    doubaoRealtimeModel: '',
    openaiContextMode: 'draft',
    openaiRealtimeAvailable: true,
    autoSpeak: false,
    autoSpeakMode: 'final',
    voiceName: '',
    rate: 1,
  }), {
    recognitionProvider: 'openai-realtime',
    recognitionLang: 'en-US',
    openaiRealtimeModel: 'llm:openai/gpt-realtime-2.1',
    doubaoRealtimeModel: '',
    openaiContextMode: 'draft',
    autoSpeak: false,
    autoSpeakMode: 'final',
    voiceName: '',
    rate: 1,
  })
})

test('discovers a registered Doubao Duplex route with server-owned credential references', () => {
  const found = registeredRealtimeModels([{
    ns: 'multi-model-provider',
    value: {
      connections: {
        'doubao-speech': {
          provider: 'doubao-speech',
          credentialRef: 'DOUBAO_API_KEY',
          credentialRefs: {
            apiKey: 'DOUBAO_API_KEY',
            realtimeApiKey: 'DOUBAO_API_KEY',
          },
          models: [{ id: 'saturn_zh_male_fuheigongzi_tob' }],
        },
      },
      models: {
        'doubao/realtime/saturn_zh_male_fuheigongzi_tob': {
          enabled: false,
          connection: 'doubao-speech',
          model: '1.2.6.1',
          task: 'realtime-speech',
          runtimeAdapter: 'doubao-realtime-duplex',
          capabilities: ['speech.realtime_session'],
          profile: {
            protocol: 'doubao-realtime-duplex',
            endpoint: 'wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue',
            voice: 'saturn_zh_male_fuheigongzi_tob',
            variant: 'sc-2.0',
          },
        },
      },
    },
  }])
  assert.equal(found.length, 1)
  assert.equal(found[0].provider, 'doubao-speech')
  assert.equal(found[0].protocol, 'doubao-realtime-duplex')
  assert.equal(found[0].credentialRef, 'DOUBAO_API_KEY')
  assert.equal(found[0].credentialRefs.realtimeApiKey, 'DOUBAO_API_KEY')
  assert.equal(found[0].voice, 'saturn_zh_male_fuheigongzi_tob')
})

test('builds a Doubao Duplex session with PCM audio and the isolated draft tool', () => {
  const built = buildDoubaoDuplexSession('1.2.6.1', 'Current draft: hello', 'session-test')
  assert.equal(built.session.id, 'session-test')
  assert.equal(built.session.type, 'realtime')
  assert.equal(built.session.model, '1.2.6.1')
  assert.equal(built.session.audio.input.format.rate, 16000)
  assert.equal(built.session.audio.output.format.rate, 24000)
  assert.equal(built.session.audio.output.voice, 'zh_female_vv_jupiter_bigtts')
  assert.deepEqual(built.session.tools.map(tool => tool.name), [
    'update_working_draft',
    'submit_to_agent',
    'end_voice_session',
  ])
  assert.equal(built.session.tools[0].strict, true)
  assert.match(built.session.instructions, /Current draft/)
})

test('maps a selected Doubao Realtime profile to its fixed protocol model and voice', () => {
  const built = buildDoubaoDuplexSession(
    '1.2.6.1',
    'Discuss the draft.',
    'session-sc',
    'saturn_zh_male_fuheigongzi_tob',
  )
  assert.equal(built.session.model, '1.2.6.1')
  assert.equal(built.session.audio.output.voice, 'saturn_zh_male_fuheigongzi_tob')
})

test('Doubao bridge requires a same-origin browser upgrade', () => {
  assert.equal(isSameOriginUpgrade({ headers: { origin: 'http://127.0.0.1:3080', host: '127.0.0.1:3080' } }), true)
  assert.equal(isSameOriginUpgrade({ headers: { origin: 'https://evil.example', host: '127.0.0.1:3080' } }), false)
  assert.equal(isSameOriginUpgrade({ headers: { host: '127.0.0.1:3080' } }), false)
})

test('Doubao bridge only emits bounded audio and structured tool results', () => {
  const state = { id: 'session-test', model: '1.2.6.1', instructions: (context) => context }
  const audio = safeUpstreamEvent({ type: 'input_audio_buffer.append', audio: 'AQID' }, state)
  assert.equal(audio.type, 'input_audio_buffer.append')
  assert.equal(audio.audio, 'AQID')
  const tool = functionResultEvent({ call_id: 'call-1', output: '{"ok":true}' })
  assert.equal(tool.items[0].role, 'tool')
  assert.equal(tool.items[0].call_id, 'call-1')
  assert.throws(() => safeUpstreamEvent({ type: 'session.create' }, state), /unsupported/)
})

test('discovers compatible registered Realtime models from task and LLM registries', () => {
  const found = registeredRealtimeModels([
    ...descriptors([{ id: 'gpt-realtime-2.1' }, { id: 'gpt-5.6-sol' }]),
    {
      ns: 'multi-model-provider',
      value: {
        connections: { openai: { provider: 'openai', credentialRef: 'OPENAI_API_KEY' } },
        models: {
          'openai/custom-realtime': {
            enabled: true,
            connection: 'openai',
            model: 'gpt-realtime-custom',
            task: 'realtime-speech',
            capabilities: ['speech.realtime_session'],
          },
          'openai/not-realtime': {
            enabled: true,
            connection: 'openai',
            model: 'gpt-image-2',
            task: 'image-generation',
          },
        },
      },
    },
  ])
  assert.deepEqual(found.map((model) => model.id), [
    'openai/custom-realtime',
    'llm:openai/gpt-realtime-2.1',
  ])
})

test('discovers compatible models from the live LLM registry even when the settings profile omits a model list', async () => {
  const found = await discoverRealtimeModels({
    settings: {
      describe() {
        return descriptors().map((entry) => ({
          ...entry,
          value: { providers: { openai: { baseURL: 'https://example.test/v1', apiKeyEnv: 'OPENAI_API_KEY' } } },
        }))
      },
    },
    llm: {
      listProviders() { return [{ id: 'openai', name: 'OpenAI' }] },
      async listModels() {
        return [{ id: 'gpt-realtime-2.1', name: 'GPT Realtime 2.1' }, { id: 'gpt-5.6-sol' }]
      },
    },
  })
  assert.deepEqual(found.map((model) => model.id), ['llm:openai/gpt-realtime-2.1'])
  assert.equal(found[0].baseURL, 'https://example.test/v1')
})

test('builds a full-duplex Realtime workspace with optional draft mutations', () => {
  const session = buildRealtimeEditorSession(
    'gpt-realtime-2.1',
    'Workspace: dsh-talk-to-text\nCurrent editable draft: keep RTCPeerConnection',
  )
  assert.deepEqual(session, {
    type: 'realtime',
    model: 'gpt-realtime-2.1',
    output_modalities: ['audio'],
    instructions: session.instructions,
    max_output_tokens: 4096,
    tools: voiceWorkspaceTools(),
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
  })
  assert.match(session.instructions, /full-duplex voice conversation/)
  assert.match(session.instructions, /update_working_draft/)
  assert.match(session.instructions, /cannot execute tasks/)
  assert.match(session.instructions, /submit_to_agent/)
  assert.match(session.instructions, /end_voice_session/)
  assert.match(session.instructions, /only channel that may mutate the draft/)
  assert.match(session.instructions, /RTCPeerConnection/)
})

test('draft tool contains only the mutation result and no conversational reply', () => {
  const tool = voiceWorkspaceTool()
  assert.equal(tool.name, 'update_working_draft')
  assert.deepEqual(tool.parameters.required, ['draft', 'summary', 'status'])
  assert.equal('reply' in tool.parameters.properties, false)
  assert.deepEqual(tool.parameters.properties.status.enum, ['drafting', 'ready'])
  assert.equal(tool.parameters.additionalProperties, false)
  assert.match(realtimeEditorInstructions('Current draft: hello'), /spoken conversation and the editable draft strictly separate/)
})

test('voice tools make submission explicit and keep execution with the primary Agent', () => {
  assert.deepEqual(voiceWorkspaceTools().map(tool => tool.name), [
    'update_working_draft',
    'submit_to_agent',
    'end_voice_session',
  ])
  assert.deepEqual(doubaoVoiceTools().map(tool => tool.name), [
    'update_working_draft',
    'submit_to_agent',
    'end_voice_session',
  ])
  const submit = submitToAgentTool()
  assert.deepEqual(submit.parameters.required, ['draft'])
  assert.match(submit.description, /primary Agent/)
  assert.match(realtimeEditorInstructions(''), /cannot execute tasks/)
  assert.match(realtimeEditorInstructions(''), /only way to submit/)
})

test('web client keeps remote audio, transcripts, and draft mutations on separate paths', () => {
  const source = readFileSync(new URL('../client/client.js', import.meta.url), 'utf8')
  assert.match(source, /pc\.ontrack =/)
  assert.match(source, /remoteAudio\.srcObject = remoteStream/)
  assert.match(source, /response\.output_audio_transcript\.delta/)
  assert.match(source, /\["update_working_draft", "submit_to_agent", "end_voice_session"\]\.includes\(call\.name\)/)
  assert.match(source, /type: "function_call_output"/)
  assert.match(source, /output_modalities: \["audio"\]/)
  assert.doesNotMatch(source, /applyDraft\(key, (?:responseTranscript|text|complete)/)
})

test('Realtime discussion uses one compact voice-only workspace while browser dictation keeps its preview', () => {
  const source = readFileSync(new URL('../client/client.js', import.meta.url), 'utf8')
  const openai = source.slice(
    source.indexOf('async function startOpenAIRealtime'),
    source.indexOf('function bytesToBase64'),
  )
  const doubao = source.slice(
    source.indexOf('async function startDoubaoRealtime'),
    source.indexOf('function toggleMic'),
  )
  const browser = source.slice(
    source.indexOf('function startBrowserRecognition'),
    source.indexOf('async function startOpenAIRealtime'),
  )

  assert.doesNotMatch(openai, /showPreview\(/)
  assert.doesNotMatch(doubao, /showPreview\(/)
  assert.match(browser, /showPreview\(/)
  assert.doesNotMatch(source, /chatvoice-workspace-(?:title|note)/)
  assert.doesNotMatch(source, /Talk to Text · 双工讨论/)
  assert.doesNotMatch(source, /data-chatvoice-workspace-action/)
  assert.doesNotMatch(source, /requestFinalize/)
  assert.match(openai, /"submit_to_agent"/)
  assert.match(openai, /submitVoiceDraft\(ta, controller\)/)
  assert.match(doubao, /"submit_to_agent"/)
  assert.match(doubao, /submitVoiceDraft\(ta, controller\)/)
})

test('Realtime session route resolves the registered model and keeps its credential server-side', async () => {
  const oldFetch = globalThis.fetch
  let upstreamRequest
  globalThis.fetch = async (url, init) => {
    upstreamRequest = { url, init }
    return new Response('v=0\r\no=answer', { status: 200, headers: { 'content-type': 'application/sdp' } })
  }

  try {
    const route = captureRoutes({ openaiRealtimeModel: 'llm:openai/gpt-realtime-2.1' })
      .find((entry) => entry.path === '/dsh-talk-to-text/realtime/session')
    assert.ok(route)
    const res = response()
    await route.handler(request(JSON.stringify({
      sdp: 'v=0\r\no=offer',
      context: 'Current draft: keep RTCPeerConnection',
    }), { 'x-dsh-talk-to-text': '1', 'content-type': 'application/json' }), res)

    assert.equal(res.status, 200)
    assert.equal(res.body, 'v=0\r\no=answer')
    assert.equal(upstreamRequest.url, 'https://example.test/v1/realtime/calls')
    assert.equal(upstreamRequest.init.headers.Authorization, 'Bearer test-server-key')
    assert.equal(upstreamRequest.init.body.get('sdp'), 'v=0\r\no=offer')
    const session = JSON.parse(upstreamRequest.init.body.get('session'))
    assert.equal(session.type, 'realtime')
    assert.equal(session.model, 'gpt-realtime-2.1')
    assert.deepEqual(session.output_modalities, ['audio'])
    assert.equal(session.tool_choice, 'auto')
    assert.deepEqual(session.tools.map(tool => tool.name), [
      'update_working_draft',
      'submit_to_agent',
      'end_voice_session',
    ])
    assert.equal(session.audio.input.turn_detection.interrupt_response, true)
    assert.equal(session.audio.output.voice, 'marin')
    assert.match(session.instructions, /Current draft: keep RTCPeerConnection/)
  } finally {
    globalThis.fetch = oldFetch
  }
})

test('Realtime session route refuses to spend API usage without the same-origin marker', async () => {
  const route = captureRoutes().find((entry) => entry.path === '/dsh-talk-to-text/realtime/session')
  const res = response()
  await route.handler(request('v=0\r\no=offer'), res)
  assert.equal(res.status, 403)
  assert.match(res.body, /request marker/)
})

test('draft finalize route uses an auto-discovered registered text model and returns only the mature draft', async () => {
  let call
  const llm = {
    listProviders() { return [{ id: 'openai', name: 'OpenAI' }] },
    async listModels() {
      return [
        { id: 'gpt-realtime-2.1', name: 'Realtime', inputModalities: ['text'] },
        { id: 'gpt-5.6-luna', name: 'GPT 5.6 Luna', inputModalities: ['text'] },
      ]
    },
    async *stream(options) {
      call = options
      yield { type: 'text-delta', index: 0, text: '成熟的最终文本' }
      yield { type: 'finish', reason: { kind: 'stop' } }
    },
  }
  const route = captureRoutes({}, { llm }).find((entry) => entry.path === '/dsh-talk-to-text/draft/finalize')
  const res = response()
  await route.handler(request(JSON.stringify({
    draft: '初稿',
    context: 'Voice discussion: keep the confirmed constraint',
  }), { 'x-dsh-talk-to-text': '1', 'content-type': 'application/json' }), res)
  const body = JSON.parse(res.body)
  assert.equal(res.status, 200)
  assert.equal(body.draft, '成熟的最终文本')
  assert.equal(call.model, 'gpt-5.6-luna')
  assert.match(call.messages[0].content[0].text, /初稿/)
  assert.match(call.messages[0].content[0].text, /confirmed constraint/)
})

test('config route auto-selects the only registered Realtime model', async () => {
  const route = captureRoutes().find((entry) => entry.path === '/dsh-talk-to-text/config')
  const req = request('')
  req.method = 'GET'
  const res = response()
  await route.handler(req, res)
  const body = JSON.parse(res.body)
  assert.equal(body.value.openaiRealtimeModel, 'llm:openai/gpt-realtime-2.1')
  assert.deepEqual(body.capabilities.realtimeModels.map((model) => model.model), ['gpt-realtime-2.1'])
  assert.equal(body.capabilities.openaiRealtime, true)
})

test('the Models provider owns Doubao credentials and the probe requires an explicit marker', async () => {
  const credentialValues = new Map()
  const credentials = {
    async resolve(ref) { return credentialValues.has(ref) ? { value: credentialValues.get(ref) } : undefined },
  }
  const doubao = [{
    ns: 'multi-model-provider',
    value: {
      connections: {
        'doubao-speech': {
          provider: 'doubao-speech',
          credentialRef: 'DOUBAO_API_KEY',
          credentialRefs: { apiKey: 'DOUBAO_API_KEY', realtimeApiKey: 'DOUBAO_API_KEY' },
        },
      },
      models: {
        'doubao/realtime-duplex-3.0': {
          connection: 'doubao-speech', model: '1.2.6.1', task: 'realtime-speech',
          runtimeAdapter: 'doubao-realtime-duplex', capabilities: ['speech.realtime_session'],
          profile: { protocol: 'doubao-realtime-duplex' },
        },
      },
    },
  }]
  const routes = captureRoutes({}, { descriptors: doubao, credentials })
  assert.equal(routes.find((entry) => entry.path === '/dsh-talk-to-text/credentials'), undefined)
  const route = routes.find((entry) => entry.path === '/dsh-talk-to-text/realtime/doubao/probe')
  const res = response()
  const req = request('')
  req.method = 'POST'
  await route.handler(req, res)
  const body = JSON.parse(res.body)
  assert.equal(res.status, 403)
  assert.match(body.error, /marker/)
})

test('normalizes OPENAI_BASE_URL with or without /v1', () => {
  const oldBase = process.env.OPENAI_BASE_URL
  try {
    process.env.OPENAI_BASE_URL = 'https://example.test/v1/'
    assert.equal(realtimeCallsUrl(), 'https://example.test/v1/realtime/calls')
    process.env.OPENAI_BASE_URL = 'https://example.test/'
    assert.equal(realtimeCallsUrl(), 'https://example.test/v1/realtime/calls')
  } finally {
    if (oldBase === undefined) delete process.env.OPENAI_BASE_URL
    else process.env.OPENAI_BASE_URL = oldBase
  }
})

test('transcription context strips NUL and enforces the host-side size bound', () => {
  const value = normalizeTranscriptionContext(`  before\0after${'x'.repeat(5_000)}  `)
  assert.equal(value.includes('\0'), false)
  assert.equal(value.length, 4_000)
  assert.match(value, /^beforeafter/)
})
