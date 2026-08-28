import assert from 'node:assert/strict'
import test from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { ComposedVoicePipelineHost } from '../src/composed-pipeline-host.ts'

function host(output) {
  const ctx = new Context()
  const calls = []
  ctx.provide('taskPipelineRuntime', { async invoke(task, input, signal) { calls.push({ task, input, signal }); return { output: output(task) } } })
  return { service: new ComposedVoicePipelineHost(ctx), calls }
}

test('composed host maps provider-neutral ASR final output', async () => {
  const { service, calls } = host(task => task === 'transcription' ? { text: ' 你好 ' } : {})
  const signal = new AbortController().signal
  const result = await service.transcribe({ routeId: 'asr/one', operation: 'transcribe-file', audio: { inputArtifactId: '123e4567-e89b-12d3-a456-426614174000' } }, signal)
  assert.equal(result.text, '你好')
  assert.deepEqual(calls[0].input.request, { inputArtifactId: '123e4567-e89b-12d3-a456-426614174000' })
  assert.equal(calls[0].signal, signal)
})

test('composed host requires a durable TTS audio URI', async () => {
  const good = host(task => task === 'speech-synthesis' ? { uri: 'attachment://spoken', mimeType: 'audio/mpeg' } : {})
  assert.equal((await good.service.synthesize({ routeId: 'tts/one', operation: 'synthesize', text: '回答' }, new AbortController().signal)).uri, 'attachment://spoken')
  const bad = host(() => ({ bytesBase64: 'forbidden-inline-media' }))
  await assert.rejects(() => bad.service.synthesize({ routeId: 'tts/one', operation: 'synthesize', text: '回答' }, new AbortController().signal), /durable audio URI/)
})
