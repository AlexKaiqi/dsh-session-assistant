import assert from 'node:assert/strict'
import test from 'node:test'
import { ComposedVoiceRemote } from '../lib/index.js'

test('composed Remote exposes only fixed ASR/TTS operations and opaque media references', async () => {
  const calls = []
  const pipeline = {
    async transcribe(request) { calls.push(request); return { text: '识别结果', output: {} } },
    async synthesize(request) { calls.push(request); return { uri: '/dsh-realtime-voice/artifacts/audio/123e4567-e89b-12d3-a456-426614174000', output: {} } },
  }
  const remote = Object.create(ComposedVoiceRemote.prototype)
  remote.pipeline = pipeline
  const signal = new AbortController().signal
  assert.deepEqual(await remote.transcribe({ routeId: 'asr-route', inputArtifactId: '123e4567-e89b-12d3-a456-426614174000' }, signal), { text: '识别结果' })
  assert.deepEqual(await remote.synthesize({ routeId: 'tts-route', text: '回答' }, signal), { uri: '/dsh-realtime-voice/artifacts/audio/123e4567-e89b-12d3-a456-426614174000', mediaType: 'audio/mpeg' })
  assert.deepEqual(calls, [
    { routeId: 'asr-route', operation: 'transcribe-file', audio: { inputArtifactId: '123e4567-e89b-12d3-a456-426614174000' } },
    { routeId: 'tts-route', operation: 'synthesize', text: '回答' },
  ])
})

test('composed Remote rejects arbitrary provider media URLs', async () => {
  const remote = Object.create(ComposedVoiceRemote.prototype)
  remote.pipeline = { async synthesize() { return { uri: 'https://example.com/tracking.mp3', output: {} } } }
  await assert.rejects(remote.synthesize({ routeId: 'tts-route', text: '回答' }, new AbortController().signal), /untrusted audio artifact URI/)
})
