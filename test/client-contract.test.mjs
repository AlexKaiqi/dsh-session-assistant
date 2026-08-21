import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../src/client/index.ts', import.meta.url), 'utf8')
const controller = await readFile(new URL('../src/client/controller.ts', import.meta.url), 'utf8')

test('client registers exactly the four required product Slots and mounts strict Remote', () => {
  const names = [...source.matchAll(/ctx\.slots\.inject\('([^']+)'/g)].map(match => match[1])
  assert.deepEqual(names, ['conversation.input.right', 'conversation.input.dock', 'conversation.chat.assistant-actions', 'settings.section'])
  assert.match(source, /ctx\.remote\.\$mount\(sessionAssistantRemote\)/)
  assert.match(source, /ctx\.get\('remote\.sessionAssistantSettings'\)/)
  assert.match(source, /remote\.describe\(\)/)
  assert.match(source, /expectedRevision: settingsView\.revision/)
})

test('client consumes provider-neutral realtimeVoice and authoritative Session input actions', () => {
  for (const member of ['capabilities', 'models', 'open', 'recognize', 'readAloud']) assert.match(source, new RegExp(`${member}\\(`))
  for (const member of ['subscribe', 'updateContext', 'resolveTool', 'interrupt', 'close']) assert.match(controller, new RegExp(`${member}\\(`))
  assert.match(controller, /inputActions\.setDraft\(draft\)/)
  assert.match(controller, /inputActions\.submit\(\)/)
  assert.match(source, /props\.messageId/)
  assert.match(source, /props\.useSession/)
  assert.match(source, /getInput: \(\) => input\.current/)
  assert.match(source, /session\.current, input\.current\.draft/)
  assert.doesNotMatch(source, /open: \(\) => \{[\s\S]{0,500}props\.use(Input|Session)/)
})

test('session-assistant contains no provider transport or DOM implementation strings', async () => {
  const files = [source, controller]
  const forbidden = [
    'RTCPeerConnection', 'WebSocket', 'AudioContext', 'ScriptProcessor', 'SpeechRecognition', 'speechSynthesis',
    'MutationObserver', 'querySelector', '.closest(', 'KeyboardEvent', 'document.body', '/dsh-session-assistant/config',
    'input_audio_buffer.', 'response.output_audio.', 'conversation.item.create', '/dsh-realtime-voice/',
  ]
  for (const value of forbidden) for (const text of files) assert.equal(text.includes(value), false, `forbidden client implementation string: ${value}`)
})
