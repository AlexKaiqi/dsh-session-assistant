import assert from 'node:assert/strict'
import test from 'node:test'
import { captureComposedUtterance, playAudioUri } from '../src/client/composed-capture.ts'

test('composed capture uses browser recognition only to delimit captured PCM', async () => {
  let options
  let closed = false
  const voiceAgent = { recognize(next) { options = next; return { close() { closed = true }, markAudioUtterance() {}, takeAudio() { return { pcm16Base64: 'AAAA', sampleRate: 16000 } } } } }
  const promise = captureComposedUtterance({ voiceAgent, language: 'zh-CN', ownerId: 'session:1', signal: new AbortController().signal })
  assert.equal(options.captureAudio, true)
  assert.equal(options.continuous, false)
  options.onTranscript({ text: 'browser hint', final: true })
  assert.deepEqual(await promise, { pcm16Base64: 'AAAA', sampleRate: 16000 })
  assert.equal(closed, true)
})

test('audio URI playback is cancellable', async () => {
  const controller = new AbortController()
  let paused = false
  const audio = { onended: null, onerror: null, play: async () => {}, pause() { paused = true } }
  const promise = playAudioUri('attachment://answer', controller.signal, () => audio)
  controller.abort(new Error('stop'))
  await assert.rejects(promise, /stop/)
  assert.equal(paused, true)
})
