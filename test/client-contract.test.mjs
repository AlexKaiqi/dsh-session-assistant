import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../src/client/index.ts', import.meta.url), 'utf8')
const controller = await readFile(new URL('../src/client/controller.ts', import.meta.url), 'utf8')
const locales = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8')

test('client registers exactly the three current-Session product Slots', () => {
  const names = [...source.matchAll(/ctx\.slots\.inject\('([^']+)'/g)].map(match => match[1])
  assert.deepEqual(names, ['conversation.input.right', 'conversation.input.dock', 'settings.section'])
  assert.match(source, /id: 'session-assistant-microphone'/)
  assert.match(source, /id: 'session-assistant-status'/)
  assert.match(source, /function MicControl/)
  assert.match(source, /function VoiceDock/)
  assert.match(source, /ctx\.remote\.\$mount\(sessionAssistantRemote\)/)
  assert.match(source, /ctx\.get\('remote\.sessionAssistantSettings'\)/)
  assert.match(source, /remote\.describe\(\)/)
  assert.match(source, /expectedRevision: settingsView\.revision/)
})

test('client UI uses one typed locale namespace for every product Slot', () => {
  assert.match(source, /ctx\.locale\.register\(NS, dictionaries as never\)/)
  assert.match(source, /const t = ctx\.locale\.bind\(NS\)/)
  assert.equal([...source.matchAll(/locale: NS/g)].length, 3)
  assert.match(locales, /settingsTitle: '会话助手'/)
  assert.match(locales, /settingsTitle: 'Session Assistant'/)
  for (const locale of ["'zh-TW'", 'ja', 'ko', 'es', 'fr', 'de', "'pt-BR'", 'ru', 'ar', 'hi']) {
    assert.match(locales, new RegExp(`(?:export const |[, ]+)${locale.replaceAll('-', '\\-')}`))
  }
  assert.match(locales, /Record<SessionAssistantLocaleKey, string>/)
  for (const hardcoded of ['结束语音会话', '开始语音会话', '最终稿就绪', '保存设置']) {
    assert.equal(source.includes(`'${hardcoded}'`), false, `inline UI copy: ${hardcoded}`)
  }
})

test('client consumes provider-neutral voiceAgent and authoritative Session input actions', () => {
  for (const member of ['capabilities', 'models', 'startConversation', 'recognize', 'registerActions']) assert.match(source, new RegExp(`${member}\\(`))
  for (const member of ['subscribe', 'updateContext', 'resolveAction', 'interrupt', 'end']) assert.match(controller, new RegExp(`${member}\\(`))
  assert.match(controller, /inputActions\.setDraft\(draft\)/)
  assert.match(controller, /inputActions\.submit\(\)/)
  assert.match(source, /props\.useSession/)
  assert.match(source, /props\.useSessions/)
  assert.match(source, /props\.useWorkspaces/)
  assert.match(source, /getInput: \(\) => input\.current/)
  assert.match(source, /buildBoundedContext\(session\.current, nextDraft, settings\(\)\.openaiContextMode, metadata\.current\)/)
  assert.match(source, /getSessionMetadata: \(\) => metadata\.current/)
  assert.match(source, /remote\.context\(/)
  assert.doesNotMatch(source, /dsh-pet-assistant:/)
  assert.match(source, /active \? controller\.stop\(\) : controller\.start\(\)/)
  assert.match(source, /ownerId: `session-assistant:\$\{sessionId\}`/)
  assert.match(source, /voiceAgent\.registerActions\(`session-assistant:\$\{sessionId\}`, tools\)/)
  assert.match(source, /if \(!event\.final\) return/)
  assert.match(source, /matchesWakePhrase\(event\.text \|\| '', wake\)/)
  assert.match(source, /captureAudio: true/)
  assert.match(source, /const captured = handle\?\.takeAudio\?\.\(\)/)
  assert.match(source, /standbyHandle\?\.discardAudio\?\.\(\)/)
  assert.match(source, /controller!\.start\(\(event\.text \|\| ''\)\.trim\(\)\.slice\(0, 20_000\), captured\)/)
  assert.match(source, /function VoiceAgentPreview/)
  assert.match(source, /voiceAgentPreviewOptions\(props\.settings, selected!\.id\)/)
  assert.match(controller, /outputOnly: false/)
  assert.match(controller, /previewText/)
  assert.match(source, /if \(close && current\) void Promise\.resolve\(current\.end\(\)\)/)
  assert.match(source, /function VoiceWave/)
  assert.match(source, /sa-wave-speak/)
  assert.doesNotMatch(source, /startConversation: \(\) => \{[\s\S]{0,500}props\.use(Input|Session)/)
  // Action execution lives in the voice Agent runtime: the controller registers
  // executors and settles results through the control handoff, never by
  // applying tools itself.
  assert.doesNotMatch(controller, /applyTool/)
  assert.match(controller, /executeTool\(name: ActionName, args: unknown, control: ActionControl\)/)
  // Knowledge curation is delegated to the dedicated curator agent.
  assert.match(controller, /organizeNotes\(parsed, control\)/)
  assert.match(source, /remote\.curate\(request\)/)
  assert.match(controller, /curate\(\{ sessionId: this\.deps\.sessionId/)
  assert.match(source, /assistantSettingsContext\(settings\(\)\)/)
  assert.match(controller, /configureAssistant\(name, parsed, control\)/)
  assert.match(source, /settingsStore\.save/)
  assert.doesNotMatch(source, /readAloud|ReadAloudAction|conversation\.chat\.assistant-actions|autoSpeak|voiceName|readRate/)
  assert.doesNotMatch(source, /completionTimer/)
  assert.match(source, /event\.type === 'error'\) \{ release\(true\)/)
  assert.doesNotMatch(source, /event\.phase === 'listening' && spoke\.current\) \{ release\(true\)/)
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
