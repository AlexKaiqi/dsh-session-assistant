import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  apply,
  normalize,
  realtimeEditorInstructions,
  sessionProfile,
} from '../dsh/index.js'
import { PROMPT } from '../dsh/model/prompt.js'
import { SESSION_ASSISTANT_TOOLS, SESSION_ASSISTANT_TOOL_OUTPUT } from '../dsh/model/tool-surface.js'
import { HELP, VERSION } from '../dsh/help.js'

test('profile limits the voice model to draft, submit, and explicit end operations', () => {
  const profile = sessionProfile()
  assert.equal(profile.id, 'session-assistant')
  assert.deepEqual(profile.tools.map(tool => tool.name), [
    'update_working_draft',
    'submit_to_agent',
    'end_voice_session',
  ])
  assert.match(realtimeEditorInstructions('recent context'), /cannot execute tasks/)
  assert.match(realtimeEditorInstructions('recent context'), /recent context/)
  assert.match(PROMPT, /cannot execute tasks/)
  assert.equal(SESSION_ASSISTANT_TOOLS.length, 3)
  assert.deepEqual(SESSION_ASSISTANT_TOOL_OUTPUT.submit_to_agent.required, ['draft'])
  assert.equal(VERSION, '0.1.0')
  assert.match(HELP, /提交给 Agent/)
})

test('normalizes persisted UI settings and excludes runtime-only state', () => {
  const value = normalize({
    recognitionProvider: 'bad',
    recognitionLang: 'bad',
    openaiRealtimeModel: 'bad key',
    doubaoRealtimeModel: 'doubao/realtime',
    rate: 9,
    realtimeModels: ['secret'],
  })
  assert.equal(value.recognitionProvider, 'doubao-realtime')
  assert.equal(value.recognitionLang, 'zh-CN')
  assert.equal(value.openaiRealtimeModel, '')
  assert.equal(value.doubaoRealtimeModel, 'doubao/realtime')
  assert.equal(value.rate, 2)
  assert.equal('realtimeModels' in value, false)
})

test('registers one role profile and one settings route against the multi-model runtime', () => {
  const routes = []
  let registeredProfile
  const scope = {
    realtimeModelRuntime: {
      registerProfile(profile) { registeredProfile = profile; return () => {} },
      async publicModels() {
        return [
          { id: 'openai/rt', model: 'gpt-realtime', displayName: 'GPT Realtime', provider: 'openai', source: 'task-model', protocol: 'openai-webrtc', available: true },
          { id: 'doubao/rt', model: '1.2.6.1', displayName: 'Doubao', provider: 'doubao-speech', source: 'task-model', protocol: 'doubao-realtime-duplex', available: true },
        ]
      },
    },
    webServer: { register(route) { routes.push(route) } },
    effect(callback) { callback() },
  }
  apply({ inject(names, callback) { assert.deepEqual(names, ['webServer', 'realtimeModelRuntime']); callback(scope) } }, {})
  assert.equal(registeredProfile.id, 'session-assistant')
  assert.deepEqual(routes.map(route => route.path), ['/dsh-session-assistant/config'])
})

test('web client sends profile and registered route to the shared runtime', async () => {
  const source = await readFile(new URL('../client/client.js', import.meta.url), 'utf8')
  assert.match(source, /\/dsh-realtime-voice\/openai\/session/)
  assert.match(source, /\/dsh-realtime-voice\/doubao/)
  assert.match(source, /profileId: VOICE_PROFILE_ID/)
  assert.match(source, /routeId: cfg\.doubaoRealtimeModel/)
  assert.match(source, /focusedSessionId = currentFocusedSessionId\(\)/)
  assert.match(source, /voiceSessionStillFocused\(controller\)/)
  assert.match(source, /语音草稿仍绑定原会话/)
  assert.doesNotMatch(source, /\/dsh-session-assistant\/realtime\/session/)
})
