import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  OPENAI_REALTIME_VOICES,
  apply,
  normalize,
  openAIProfileId,
  realtimeEditorInstructions,
  sessionProfile,
  sessionProfiles,
} from '../dsh/index.js'
import { PROMPT } from '../dsh/model/prompt.js'
import { SESSION_ASSISTANT_TOOLS, SESSION_ASSISTANT_TOOL_OUTPUT } from '../dsh/model/tool-surface.js'
import { HELP, VERSION } from '../dsh/help.js'

test('profile limits the voice model to draft, submit, and explicit end operations', () => {
  const profile = sessionProfile()
  assert.equal(profile.id, 'session-assistant')
  assert.deepEqual(profile.voice, {})
  assert.equal(sessionProfiles().length, OPENAI_REALTIME_VOICES.length + 1)
  assert.equal(sessionProfiles().find(item => item.id === openAIProfileId('cedar')).voice.openai, 'cedar')
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
    openaiRealtimeVoice: 'not-a-voice',
    rate: 9,
    realtimeModels: ['secret'],
  })
  assert.equal(value.recognitionProvider, 'doubao-realtime')
  assert.equal(value.recognitionLang, 'zh-CN')
  assert.equal(value.openaiRealtimeModel, '')
  assert.equal(value.doubaoRealtimeModel, 'doubao/realtime')
  assert.equal(value.openaiRealtimeVoice, 'marin')
  assert.equal(value.rate, 2)
  assert.equal('realtimeModels' in value, false)
})

test('registers one role profile and one settings route against the multi-model runtime', () => {
  const routes = []
  const registeredProfiles = []
  const scope = {
    realtimeModelRuntime: {
      registerProfile(profile) { registeredProfiles.push(profile); return () => {} },
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
  assert.equal(registeredProfiles[0].id, 'session-assistant')
  assert.equal(registeredProfiles.length, OPENAI_REALTIME_VOICES.length + 1)
  assert.deepEqual(routes.map(route => route.path), ['/dsh-session-assistant/config'])
})

test('web client sends profile and registered route to the shared runtime', async () => {
  const source = await readFile(new URL('../client/client.js', import.meta.url), 'utf8')
  assert.match(source, /\/dsh-realtime-voice\/openai\/session/)
  assert.match(source, /\/dsh-realtime-voice\/doubao/)
  assert.match(source, /profileId: VOICE_PROFILE_ID/)
  assert.match(source, /profileId: openAIProfileId\(cfg\.openaiRealtimeVoice\)/)
  assert.match(source, /routeId: cfg\.doubaoRealtimeModel/)
  assert.match(source, /focusedSessionId = currentFocusedSessionId\(\)/)
  assert.match(source, /voiceSessionStillFocused\(controller\)/)
  assert.match(source, /语音草稿仍绑定原会话/)
  assert.doesNotMatch(source, /\/dsh-session-assistant\/realtime\/session/)
})

test('settings are provider-capability driven and browser voices use a select', async () => {
  const source = await readFile(new URL('../client/client.js', import.meta.url), 'utf8')
  assert.match(source, /controls: \["language"\]/)
  assert.match(source, /controls: \["model", "openaiVoice", "context"\]/)
  assert.match(source, /controls: \["doubaoVoice", "context"\]/)
  assert.match(source, /"浏览器朗读音色"/)
  assert.match(source, /browserVoiceOptions\(\)/)
  assert.doesNotMatch(source, /type: "text", className: "chatvoice-input", value: state\.value\.voiceName/)
})

test('web client owns observer, timer, media, DOM, and listener cleanup through lifecycle effects', async () => {
  const source = await readFile(new URL('../client/client.js', import.meta.url), 'utf8')
  assert.match(source, /ctx\.effect\(\(\) => \{/)
  assert.match(source, /mo\.disconnect\(\)/)
  assert.match(source, /clearInterval\(interval\)/)
  assert.match(source, /active && active\.stop\(\)/)
  assert.match(source, /removeEventListener\("scroll", positionPreview, true\)/)
  assert.match(source, /\[data-chatvoice-mic\],\[data-chatvoice-speak\]/)
})
