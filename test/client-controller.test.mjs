import assert from 'node:assert/strict'
import test from 'node:test'
import { VoiceController, providerOpenOptions, readAloudPreviewOptions, realtimeVoicePreviewOptions } from '../lib/controller.js'
import { buildBoundedContext } from '../lib/index.js'

function harness(initial = 'base') {
  let draft = initial
  let submitted = 0
  const resolved = []
  const contexts = []
  let listener
  let closed = 0
  const handle = {
    subscribe(next) { listener = next; return () => { listener = undefined } },
    updateContext(value) { contexts.push(value) },
    resolveTool(callId, result) { resolved.push({ callId, result }) },
    interrupt() {}, close() { closed++ },
  }
  const controller = new VoiceController({
    sessionId: 'session-a',
    inputActions: { setDraft(value) { draft = value }, submit() { submitted++ } },
    getInput: () => ({ draft }), context: () => `draft:${draft}`, open: async () => handle,
  })
  return { controller, emit: event => listener?.(event), setDraft: value => { draft = value }, draft: () => draft, submitted: () => submitted, resolved, contexts, closed: () => closed }
}

test('controller applies complete drafts only through inputActions and distinguishes submit from end', async () => {
  const h = harness()
  await h.controller.start()
  await h.controller.consume({ type: 'tool', callId: 'u1', name: 'update_working_draft', arguments: { draft: 'ready text', summary: 'edit', status: 'ready' } })
  assert.equal(h.draft(), 'ready text')
  assert.equal(h.submitted(), 0)
  await h.controller.consume({ type: 'tool', callId: 's1', name: 'submit_to_agent', arguments: { draft: 'final text' } })
  assert.equal(h.draft(), 'final text')
  assert.equal(h.submitted(), 1)
  await h.controller.consume({ type: 'tool', callId: 'e1', name: 'end_voice_session', arguments: {} })
  assert.equal(h.submitted(), 1)
  assert.equal(h.closed(), 1)
  assert.deepEqual(h.resolved.map(item => item.callId), ['u1', 's1', 'e1'])
})

test('controller rejects concurrent edits and all tool application after disposal', async () => {
  const h = harness()
  await h.controller.start()
  h.setDraft('keyboard edit')
  await h.controller.consume({ type: 'tool', callId: 'conflict', name: 'update_working_draft', arguments: { draft: 'model edit', summary: 'edit', status: 'drafting' } })
  assert.equal(h.draft(), 'keyboard edit')
  assert.match(h.resolved[0].result.error, /concurrently/)
  await h.controller.stop()
  await h.controller.consume({ type: 'tool', callId: 'late', name: 'submit_to_agent', arguments: { draft: 'late' } })
  assert.equal(h.draft(), 'keyboard edit')
  assert.equal(h.submitted(), 0)
})

test('provider selection is data-only and bounded context excludes hidden/running nodes', () => {
  assert.deepEqual(providerOpenOptions({ recognitionProvider: 'openai-realtime', recognitionLang: 'zh-CN', openaiRealtimeModel: 'route', openaiRealtimeVoice: 'cedar', doubaoRealtimeModel: '', openaiContextMode: 'recent', autoSpeak: false, autoSpeakMode: 'final', voiceName: '', rate: 1 }, 'ctx'), {
    protocol: 'openai-webrtc', routeId: 'route', profileId: 'session-assistant-openai-cedar', context: 'ctx', language: 'zh-CN',
  })
  const nodes = new Map([
    ['visible', { kind: 'user', data: { content: [{ type: 'text', text: 'visible context' }] } }],
    ['hidden', { kind: 'user', visibility: 'hidden', data: { content: [{ type: 'text', text: 'secret' }] } }],
    ['running', { kind: 'assistant-step', data: { status: 'running', blocks: [{ type: 'text', text: 'thinking' }] } }],
  ])
  const context = buildBoundedContext({ chat: { order: ['visible', 'hidden', 'running'], nodes } }, 'draft', 'recent')
  assert.match(context, /visible context/)
  assert.doesNotMatch(context, /secret|thinking/)
  assert.ok(context.length <= 3800)
})

test('read-aloud preview uses the unsaved language, voice, and speed settings', () => {
  const base = { recognitionProvider: 'browser', recognitionLang: 'zh-CN', openaiRealtimeModel: '', openaiRealtimeVoice: 'marin', doubaoRealtimeModel: '', openaiContextMode: 'recent', autoSpeak: false, autoSpeakMode: 'final', voiceName: 'Voice A', rate: 1.3 }
  assert.deepEqual(readAloudPreviewOptions(base), {
    text: '你好，我是你的语音助手。这样的声音和语速合适吗？', voiceName: 'Voice A', lang: 'zh-CN', rate: 1.3,
  })
  assert.deepEqual(readAloudPreviewOptions({ ...base, recognitionLang: 'en-US', voiceName: '' }), {
    text: 'Hello, I am your voice assistant. Does this voice and speed sound right?', lang: 'en-US', rate: 1.3,
  })
  assert.deepEqual(realtimeVoicePreviewOptions({ ...base, recognitionProvider: 'doubao-realtime', doubaoRealtimeModel: 'doubao/voice-a' }), {
    protocol: 'doubao-realtime-duplex', routeId: 'doubao/voice-a', profileId: 'session-assistant-preview',
    context: '你好，我是你的语音助手。这样的声音和语速合适吗？', outputOnly: true,
    previewText: '你好，我是你的语音助手。这样的声音和语速合适吗？',
  })
  assert.deepEqual(realtimeVoicePreviewOptions({ ...base, recognitionProvider: 'openai-realtime', openaiRealtimeModel: 'openai/gpt-realtime', openaiRealtimeVoice: 'cedar' }), {
    protocol: 'openai-webrtc', routeId: 'openai/gpt-realtime', profileId: 'session-assistant-preview-openai-cedar',
    context: '你好，我是你的语音助手。这样的声音和语速合适吗？', outputOnly: true,
    previewText: '你好，我是你的语音助手。这样的声音和语速合适吗？',
  })
})
