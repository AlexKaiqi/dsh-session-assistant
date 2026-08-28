import assert from 'node:assert/strict'
import test from 'node:test'
import { ComposedVoiceTurn, composedPipeline } from '../src/voice-pipeline.ts'
import { assistantReplyCursor, finalAgentReplyAfter } from '../src/client/context.ts'

test('composed voice turn keeps provider protocols outside orchestration', async () => {
  const phases = []
  const calls = []
  const turn = new ComposedVoiceTurn(composedPipeline({
    asrRouteId: 'asr/explicit',
    ttsRouteId: 'tts/explicit',
    language: { source: 'current-session' },
  }), {
    async transcribe(audio, stage) { calls.push(['asr', audio, stage.routeId]); return '你好' },
    async submit(text, stage) { calls.push(['agent', text, stage.source]); return { text: '您好' } },
    replyText(reply) { return reply.text },
    async synthesize(text, stage) { calls.push(['tts', text, stage.routeId]); return 'audio-output' },
    async play(audio) { calls.push(['play', audio]) },
    onPhase(phase) { phases.push(phase) },
  })
  await turn.run('audio-input')
  assert.deepEqual(calls, [
    ['asr', 'audio-input', 'asr/explicit'],
    ['agent', '你好', 'current-session'],
    ['tts', '您好', 'tts/explicit'],
    ['play', 'audio-output'],
  ])
  assert.deepEqual(phases, ['transcribing', 'thinking', 'synthesizing', 'playing', 'idle'])
})

test('final reply cursor waits for the whole Agent turn and extracts text only', () => {
  const first = { kind: 'assistant-step', data: { status: 'settled', blocks: [{ kind: 'text', text: '旧回复' }] } }
  const nodes = new Map([['a1', first]])
  const cursor = assistantReplyCursor({ running: false, chat: { order: ['a1'], nodes } })
  assert.equal(cursor, 'a1')
  nodes.set('a2', { kind: 'assistant-step', data: { status: 'settled', turn: 2, step: 1, blocks: [{ kind: 'reasoning', text: '内部' }], finalNode: { messageId: 'm2', blocks: [{ kind: 'text', text: '最终答复' }] } } })
  const running = { running: true, chat: { order: ['a1', 'a2'], nodes } }
  assert.equal(finalAgentReplyAfter(running, cursor), undefined)
  assert.deepEqual(finalAgentReplyAfter({ ...running, running: false }, cursor), {
    nodeKey: 'a2', turn: 2, step: 1, messageId: 'm2', text: '最终答复', interrupted: false,
  })
})
