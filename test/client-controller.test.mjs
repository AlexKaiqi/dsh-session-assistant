import assert from 'node:assert/strict'
import test from 'node:test'
import { VoiceController, assistantSettingsContext, matchesWakePhrase, selectVoiceRoute, voiceConversationOptions, voiceAgentPreviewOptions } from '../lib/controller.js'
import { awarenessEventsInSession, buildBoundedContext } from '../lib/index.js'

function harness(initial = 'base') {
  let draft = initial
  let submitted = 0
  let failContext = false
  let curateResult = { available: true, ok: true, proposals: ['p1'], currentUpdated: true }
  const contexts = []
  const startedWith = []
  const order = []
  const curateCalls = []
  let listener
  let closed = 0
  let interrupted = 0
  const awareness = []
  let settings = { recognitionProvider: 'doubao-realtime', recognitionLang: 'zh-CN', openaiRealtimeModel: '', openaiRealtimeVoice: 'marin', doubaoRealtimeModel: '', openaiContextMode: 'recent', wakeWord: '你好助手' }
  const handle = {
    subscribe(next) { listener = next; return () => { listener = undefined } },
    updateContext(value) { contexts.push(value) },
    resolveAction(callId, result) { order.push(`handle-resolve:${callId}`) },
    interrupt() { interrupted++ }, end() { closed++ },
  }
  let executors
  let disposeCount = 0
  const controller = new VoiceController({
    sessionId: 'session-a',
    inputActions: { setDraft(value) { draft = value }, submit() { submitted++; order.push('submit') } },
    getInput: () => ({ draft }),
    context: () => { if (failContext) { failContext = false; throw new Error('knowledge unavailable') } return `draft:${draft}` },
    startConversation: async (initialUserText, initialAudio) => { startedWith.push({ initialUserText, initialAudio }); return handle },
    // Voice Agent action-registry handoff: capture the executors and dispose
    // count so tests drive the same path the runtime uses.
    registerActions: tools => { executors = tools; return () => { disposeCount++ } },
    // Dedicated curator agent delegation (async completion).
    curate: async request => { curateCalls.push(request); return curateResult },
    getSettings: () => settings,
    updateSettings: async patch => { settings = { ...settings, ...patch }; return settings },
    notifyAwareness: event => { awareness.push(event) },
  })
  const runTool = async (name, args) => {
    const calls = []
    const control = {
      resolve(result, options) {
        calls.push({ result, options })
        order.push(`resolve:${name}`)
        return true
      },
    }
    await executors[name].execute(args, control)
    return calls
  }
  return {
    controller, emit: event => listener?.(event), setDraft: value => { draft = value }, draft: () => draft,
    submitted: () => submitted, failContext: () => { failContext = true }, runTool, contexts, order,
    closed: () => closed, interrupted: () => interrupted, awareness, disposeCount: () => disposeCount, curateCalls, startedWith, settings: () => settings,
    setCurateResult: result => { curateResult = result },
  }
}

test('controller applies complete drafts only through inputActions and distinguishes submit from end', async () => {
  const h = harness()
  await h.controller.start()
  const u1 = await h.runTool('update_working_draft', { draft: 'ready text', summary: 'edit', status: 'ready' })
  assert.equal(h.draft(), 'ready text')
  assert.equal(h.submitted(), 0)
  const s1 = await h.runTool('submit_to_agent', { draft: 'final text' })
  assert.equal(h.draft(), 'final text')
  assert.equal(h.submitted(), 1)
  await h.runTool('end_voice_session', {})
  assert.equal(h.submitted(), 1)
  assert.equal(h.closed(), 1)
  assert.deepEqual(u1[0].result, { ok: true, draft: 'ready text', status: 'ready' })
  assert.deepEqual(s1[0].result, { ok: true, draft: 'final text', status: 'ready' })
})

test('prepare_agent_handoff stages a visible request without submitting it', async () => {
  const h = harness()
  await h.controller.start()
  const prepared = await h.runTool('prepare_agent_handoff', { draft: 'Inspect the workspace and fix the failing test.', reason: 'Requires workspace files and command execution.' })
  assert.equal(h.draft(), 'Inspect the workspace and fix the failing test.')
  assert.equal(h.submitted(), 0)
  assert.deepEqual(prepared[0].result, {
    ok: true,
    draft: 'Inspect the workspace and fix the failing test.',
    status: 'awaiting_confirmation',
    reason: 'Requires workspace files and command execution.',
  })
  assert.deepEqual(h.controller.getSnapshot().handoff, { reason: 'Requires workspace files and command execution.' })
  await h.runTool('submit_to_agent', { draft: h.draft() })
  assert.equal(h.submitted(), 1)
  assert.equal(h.controller.getSnapshot().handoff, undefined)
})

test('submit_to_agent settles the tool result before submitting the draft', async () => {
  const h = harness()
  await h.controller.start()
  const s1 = await h.runTool('submit_to_agent', { draft: 'final text' })
  assert.equal(h.submitted(), 1)
  assert.deepEqual(h.order, ['resolve:submit_to_agent', 'submit'])
  assert.deepEqual(s1[0].result, { ok: true, draft: 'final text', status: 'ready' })
  assert.equal(h.controller.getSnapshot().submitNotice, true)
})

test('an empty submit_to_agent draft is rejected visibly instead of silently no-oping', async () => {
  const h = harness()
  await h.controller.start()
  const s1 = await h.runTool('submit_to_agent', { draft: '' })
  assert.equal(h.submitted(), 0)
  assert.deepEqual(s1[0].result, { ok: false, error: 'There is no draft content to submit. Ask the user to dictate what to send first.' })
  const state = h.controller.getSnapshot()
  assert.equal(state.submitNotice, undefined)
  assert.equal(state.status, 'error')
  assert.equal(state.errorCode, 'empty_submit')
  // Whitespace-only drafts are empty too.
  const s2 = await h.runTool('submit_to_agent', { draft: '   ' })
  assert.equal(h.submitted(), 0)
  assert.equal(s2[0].result.ok, false)
})

test('a failing context projection never blocks the tool result or the submission', async () => {
  const h = harness()
  h.failContext()
  await h.controller.start()
  const s1 = await h.runTool('submit_to_agent', { draft: 'final text' })
  assert.equal(h.submitted(), 1)
  assert.deepEqual(s1[0].result, { ok: true, draft: 'final text', status: 'ready' })
  assert.equal(h.controller.getSnapshot().status, 'active')
  assert.equal(h.controller.getSnapshot().submitNotice, true)
})

test('controller rejects concurrent edits and all tool execution after disposal', async () => {
  const h = harness()
  await h.controller.start()
  h.setDraft('keyboard edit')
  const conflict = await h.runTool('update_working_draft', { draft: 'model edit', summary: 'edit', status: 'drafting' })
  assert.equal(h.draft(), 'keyboard edit')
  assert.match(conflict[0].result.error, /concurrently/)
  await h.controller.stop()
  await h.runTool('submit_to_agent', { draft: 'late' })
  assert.equal(h.draft(), 'keyboard edit')
  assert.equal(h.submitted(), 0)
})

test('disposing the controller unregisters its tools from the runtime registry', async () => {
  const h = harness()
  assert.equal(h.disposeCount(), 0)
  await h.controller.dispose()
  assert.equal(h.disposeCount(), 1)
})

test('provider selection is data-only and bounded context carries workspace facts while excluding hidden/running nodes', () => {
  assert.deepEqual(voiceConversationOptions({ recognitionProvider: 'openai-realtime', recognitionLang: 'zh-CN', openaiRealtimeModel: 'route', openaiRealtimeVoice: 'cedar', doubaoRealtimeModel: '', openaiContextMode: 'recent', wakeWord: '你好助手' }, 'ctx'), {
    routeId: 'route', protocol: 'openai-webrtc', profileId: 'session-assistant-openai-cedar', context: 'ctx', language: 'zh-CN',
  })
  const nodes = new Map([
    ['visible', { kind: 'user', data: { content: [{ type: 'text', text: 'visible context' }] } }],
    ['hidden', { kind: 'user', visibility: 'hidden', data: { content: [{ type: 'text', text: 'secret' }] } }],
    ['running', { kind: 'assistant-step', data: { status: 'running', blocks: [{ type: 'text', text: 'thinking' }] } }],
  ])
  const metadata = { sessionId: 'session-a', sessionTitle: 'Fix tests', cwd: '/work/acme', agentPreset: 'multi-model-voice', workspaceId: 'workspace-a', workspaceTitle: 'Acme' }
  const context = buildBoundedContext({ chat: { order: ['visible', 'hidden', 'running'], nodes } }, 'draft', 'recent', metadata)
  assert.match(context, /session-a|workspace-a|\/work\/acme|multi-model-voice/)
  assert.match(context, /visible context/)
  assert.doesNotMatch(context, /secret|thinking/)
  assert.ok(context.length <= 5200)
  const hostNodes = {
    get: id => nodes.get(id),
    values: () => [...nodes].map(([key, value]) => ({ key, id: key, target: 'chat', ...value })),
  }
  const hostContext = buildBoundedContext({ chat: { order: ['visible', 'hidden', 'running'], nodes: hostNodes } }, 'draft', 'recent', metadata)
  assert.match(hostContext, /visible context/)
  assert.doesNotMatch(hostContext, /secret|thinking/)
  assert.doesNotThrow(() => awarenessEventsInSession({ chat: { order: ['visible', 'hidden', 'running'], nodes: hostNodes } }))
  const operationalOnly = buildBoundedContext({}, 'hidden draft', 'off', metadata)
  assert.match(operationalOnly, /\/work\/acme|multi-model-voice/)
  assert.doesNotMatch(operationalOnly, /hidden draft/)
})

test('the voice tour opens an interactive product guide on the selected model and voice', () => {
  const base = { recognitionProvider: 'browser', recognitionLang: 'zh-CN', openaiRealtimeModel: '', openaiRealtimeVoice: 'marin', doubaoRealtimeModel: '', openaiContextMode: 'recent', wakeWord: '你好助手' }
  assert.deepEqual(voiceAgentPreviewOptions({ ...base, recognitionProvider: 'doubao-realtime', doubaoRealtimeModel: 'doubao/voice-a' }), {
    routeId: 'doubao/voice-a', protocol: 'doubao-realtime-duplex', profileId: 'session-assistant-preview',
    outputOnly: false,
    previewText: '请简短欢迎我，并告诉我可以直接问你这个会话助手插件能做什么、有什么边界或推荐工作流，然后等我继续提问。',
  })
  assert.deepEqual(voiceAgentPreviewOptions({ ...base, recognitionProvider: 'openai-realtime', openaiRealtimeModel: 'openai/gpt-realtime', openaiRealtimeVoice: 'cedar' }), {
    routeId: 'openai/gpt-realtime', protocol: 'openai-webrtc', profileId: 'session-assistant-preview-openai-cedar',
    outputOnly: false,
    previewText: '请简短欢迎我，并告诉我可以直接问你这个会话助手插件能做什么、有什么边界或推荐工作流，然后等我继续提问。',
  })
})

test('the voice assistant can inspect and persist its own non-secret settings', async () => {
  const h = harness()
  await h.controller.start()
  const described = await h.runTool('get_assistant_settings', {})
  assert.equal(described[0].result.ok, true)
  assert.equal(described[0].result.settings.wakeWord, '你好助手')
  const updated = await h.runTool('update_assistant_settings', { wakeWord: '你好小助理' })
  assert.equal(updated[0].result.ok, true)
  assert.deepEqual(updated[0].result.changed, ['wakeWord'])
  assert.equal(updated[0].result.standbyRestartRequired, true)
  assert.equal(updated[0].result.reconnectRequired, false)
  assert.deepEqual(h.settings(), { ...described[0].result.settings, wakeWord: '你好小助理' })
  assert.match(assistantSettingsContext(h.settings()), /你好小助理/)
  assert.doesNotMatch(assistantSettingsContext(h.settings()), /read-aloud|autoSpeak|voiceName|rate/)
  const invalid = await h.runTool('update_assistant_settings', { rate: 1.4 })
  assert.equal(invalid[0].result.ok, false)
})

test('an empty configured route selects the first callable model for both conversations and previews', () => {
  const settings = { recognitionProvider: 'doubao-realtime', recognitionLang: 'zh-CN', openaiRealtimeModel: '', openaiRealtimeVoice: 'marin', doubaoRealtimeModel: '', openaiContextMode: 'recent', wakeWord: '你好助手' }
  const models = [
    { id: 'doubao/unavailable', protocol: 'doubao-realtime-duplex', available: false },
    { id: 'openai/available', protocol: 'openai-webrtc', available: true },
    { id: 'doubao/available', protocol: 'doubao-realtime-duplex', available: true },
  ]
  const routeId = selectVoiceRoute(settings, models)
  assert.equal(routeId, 'doubao/available')
  assert.equal(voiceConversationOptions(settings, 'ctx', routeId).routeId, 'doubao/available')
  assert.equal(voiceAgentPreviewOptions(settings, routeId).routeId, 'doubao/available')
  assert.equal(selectVoiceRoute({ ...settings, doubaoRealtimeModel: 'doubao/available' }, models), 'doubao/available')
  assert.equal(selectVoiceRoute({ ...settings, doubaoRealtimeModel: 'openai/available' }, models), 'doubao/available')
  assert.equal(selectVoiceRoute({ ...settings, doubaoRealtimeModel: 'doubao/unavailable' }, models), 'doubao/available')
})

test('an empty startup catalog preserves the selected duplex protocol for Host auto-selection', () => {
  const settings = { recognitionProvider: 'doubao-realtime', recognitionLang: 'zh-CN', openaiRealtimeModel: '', openaiRealtimeVoice: 'marin', doubaoRealtimeModel: '', openaiContextMode: 'recent', wakeWord: '你好助手' }
  const routeId = selectVoiceRoute(settings, [])
  assert.equal(routeId, '')
  assert.deepEqual(voiceConversationOptions(settings, 'ctx', routeId), {
    routeId: '', protocol: 'doubao-realtime-duplex', profileId: 'session-assistant', context: 'ctx', language: 'zh-CN',
  })
})

test('observeSession surfaces primary-Agent questions and announces replies after submission', async () => {
  const h = harness()
  await h.controller.start()
  const questionNodes = new Map([
    ['s1', { kind: 'assistant-step', data: { status: 'done', blocks: [{ type: 'tool-call', callId: 'q1', name: 'ask_user_question', arguments: '{"questions":[{"question":"选 A 还是 B？","options":[{"label":"A"},{"label":"B"}]}]}' }] } }],
  ])
  h.controller.observeSession({ chat: { order: ['s1'], nodes: questionNodes } })
  const state = h.controller.getSnapshot()
  assert.equal(state.question?.callId, 'q1')
  assert.match(state.question?.text ?? '', /选 A 还是 B/)
  assert.match(state.question?.text ?? '', /A \/ B/)
  // Repeated observation does not re-announce the same question.
  h.controller.observeSession({ chat: { order: ['s1'], nodes: questionNodes } })
  assert.equal(h.controller.getSnapshot().question?.callId, 'q1')
  // After a submission, a NEW finished assistant step marks the reply and is surfaced once.
  await h.runTool('submit_to_agent', { draft: 'final' })
  assert.equal(h.controller.getSnapshot().submitNotice, true)
  const replyNodes = new Map([
    ['s1', { kind: 'assistant-step', data: { status: 'done', blocks: [{ type: 'tool-call', callId: 'q1', name: 'ask_user_question', arguments: '{}' }] } }],
    ['s2', { kind: 'assistant-step', data: { status: 'done', blocks: [{ type: 'text', text: '结果在这里' }] } }],
  ])
  h.controller.observeSession({ chat: { order: ['s1', 's2'], nodes: replyNodes } })
  assert.equal(h.controller.getSnapshot().agentReply, true)
  h.controller.observeSession({ chat: { order: ['s1', 's2'], nodes: replyNodes } })
  assert.equal(h.controller.getSnapshot().agentReply, true)
})

test('session awareness adapters announce blocking questions and significant plan milestones but keep subagent reports internal', async () => {
  const h = harness()
  await h.controller.start()
  const nodes = new Map([
    ['plan-1', { kind: 'assistant-step', data: { status: 'settled', blocks: [{ kind: 'tool-call', callId: 'p1', name: 'todo_write', argsRaw: JSON.stringify({ todos: [{ content: 'Inspect files', status: 'in_progress' }, { content: 'Run tests', status: 'pending' }] }) }] } }],
    ['report-1', { kind: 'steering', data: { messageId: 'report-message-1', source: { kind: 'subagent-report', senderSessionId: 'child-a' }, content: [{ type: 'text', text: 'Background subagent child-a reported:' }, { type: 'text', text: 'Found the failing module.' }] } }],
  ])
  let snapshot = { chat: { order: ['plan-1', 'report-1'], nodes } }
  const projected = awarenessEventsInSession(snapshot)
  assert.deepEqual(projected.map(event => [event.type, event.visibility, event.voicePolicy]), [
    ['plan_updated', 'user', 'summary'],
    ['agent_report', 'internal', 'silent'],
  ])
  assert.equal(projected[1].text, 'Found the failing module.')
  h.controller.observeSession(snapshot)
  assert.equal(h.awareness.length, 1)
  assert.equal(h.awareness[0].type, 'plan_updated')
  assert.equal(h.controller.getSnapshot().planNotice?.active[0], 'Inspect files')

  // A new tool call with no visible milestone is absorbed without another announcement.
  nodes.set('plan-2', { kind: 'assistant-step', data: { status: 'settled', blocks: [{ type: 'tool-call', id: 'p2', name: 'todo_write', arguments: JSON.stringify({ todos: [{ content: 'Inspect files', status: 'in_progress' }, { content: 'Run tests', status: 'pending' }] }) }] } })
  snapshot = { chat: { order: ['plan-1', 'report-1', 'plan-2'], nodes } }
  h.controller.observeSession(snapshot)
  assert.equal(h.awareness.length, 1)

  nodes.set('plan-3', { kind: 'assistant-step', data: { status: 'settled', blocks: [{ type: 'tool-call', id: 'p3', name: 'todo_write', arguments: { todos: [{ content: 'Inspect files', status: 'completed' }, { content: 'Run tests', status: 'in_progress' }] } }] } })
  nodes.set('question-1', { kind: 'assistant-step', data: { status: 'running', blocks: [{ type: 'tool-call', callId: 'q2', name: 'ask_user_question', arguments: JSON.stringify({ questions: [{ question: 'Proceed with the migration?', options: [{ label: 'Proceed' }, { label: 'Stop' }] }] }) }] } })
  snapshot = { chat: { order: ['plan-1', 'report-1', 'plan-2', 'plan-3', 'question-1'], nodes } }
  h.emit({ type: 'phase', phase: 'speaking' })
  h.controller.observeSession(snapshot)
  assert.deepEqual(h.awareness.slice(1).map(event => event.type), ['plan_updated', 'user_input_required'])
  assert.equal(h.controller.getSnapshot().planNotice?.completed, 1)
  assert.match(h.controller.getSnapshot().question?.text ?? '', /Proceed with the migration/)
  assert.equal(h.interrupted(), 1)
  // Re-observing the same snapshot is idempotent.
  h.controller.observeSession(snapshot)
  assert.equal(h.awareness.length, 3)
})

test('standby enters and exits through the wake-word listener and never overlaps a voice session', async () => {
  let entered = 0
  let exited = 0
  const controller = new VoiceController({
    sessionId: 'session-a',
    inputActions: { setDraft() {}, submit() {} },
    getInput: () => ({ draft: 'x' }),
    context: async () => '',
    startConversation: async () => ({
      subscribe() { return () => {} }, updateContext() {}, resolveAction() {}, interrupt() {}, end() {},
    }),
    standby: { enter() { entered += 1; return true }, exit() { exited += 1 } },
    registerActions: () => () => {},
  })
  assert.equal(controller.canEnterStandby, true)
  assert.equal(await controller.enterStandby(), true)
  assert.equal(controller.getSnapshot().status, 'standby')
  assert.equal(entered, 1)
  // Starting a voice session releases standby first.
  await controller.start()
  assert.equal(controller.getSnapshot().status, 'active')
  assert.equal(exited, 1)
  // Standby is unavailable while a voice session is active.
  assert.equal(controller.canEnterStandby, false)
  assert.equal(await controller.enterStandby(), false)
  await controller.stop()
  assert.equal(controller.getSnapshot().status, 'idle')
  // Re-enter standby after stopping.
  assert.equal(await controller.enterStandby(), true)
  assert.equal(controller.getSnapshot().status, 'standby')
  await controller.exitStandby()
  assert.equal(controller.getSnapshot().status, 'idle')
  // Releases: start() + stop() + exitStandby() = 3.
  assert.equal(exited, 3)
})

test('a complete wake utterance is preserved as the initial user turn', async () => {
  assert.equal(matchesWakePhrase('你好，助手！继续检查刚才的修改', '你好助手'), true)
  assert.equal(matchesWakePhrase('Hello Assistant — summarize this', 'hello assistant'), true)
  assert.equal(matchesWakePhrase('没有唤醒词', '你好助手'), false)
  const h = harness()
  const initialAudio = { pcm16Base64: 'AAAA', sampleRate: 24000 }
  await h.controller.start('你好，助手！继续检查刚才的修改', initialAudio)
  assert.deepEqual(h.startedWith, [{ initialUserText: '你好，助手！继续检查刚才的修改', initialAudio }])
})

test('organize_notes settles immediately and delegates curation to the curator agent asynchronously', async () => {
  const h = harness()
  await h.controller.start()
  const calls = await h.runTool('organize_notes', { instruction: 'organize the accepted decisions' })
  // The tool result is settled before the async curation completes (dual output).
  assert.equal(calls[0].result.ok, true)
  assert.match(calls[0].result.note, /started/)
  assert.equal(h.curateCalls.length, 1)
  assert.equal(h.curateCalls[0].sessionId, 'session-a')
  assert.equal(h.curateCalls[0].instruction, 'organize the accepted decisions')
  assert.match(h.curateCalls[0].extra, /base/)
  const state = h.controller.getSnapshot()
  assert.equal(state.curatorNotice.ok, true)
  assert.equal(state.curatorNotice.proposals, 1)
})

test('organize_notes passes the draft and failure is announced honestly', async () => {
  const h = harness()
  await h.controller.start()
  h.setCurateResult({ available: true, ok: false, proposals: [], currentUpdated: false, error: 'curator crashed' })
  const calls = await h.runTool('organize_notes', {})
  assert.equal(calls[0].result.ok, true)
  assert.equal(h.curateCalls[0].extra, 'base')
  const state = h.controller.getSnapshot()
  assert.equal(state.curatorNotice.ok, false)
})

test('organize_notes without a curator remote reports knowledge-base-missing visibly', async () => {
  const h = harness()
  await h.controller.start()
  h.setCurateResult({ available: false, ok: false, proposals: [], currentUpdated: false })
  const calls = await h.runTool('organize_notes', {})
  assert.equal(calls[0].result.ok, true)
  assert.equal(h.curateCalls[0].extra, 'base')
  const state = h.controller.getSnapshot()
  assert.equal(state.curatorNotice.ok, false)
  assert.equal(state.curatorNotice.error, 'knowledge-base-missing')
})

test('organize_notes with no curate dependency rejects the tool instead of hanging', async () => {
  const h = harness()
  await h.controller.start()
  const controller = new VoiceController({
    sessionId: 'session-b',
    inputActions: { setDraft() {}, submit() {} },
    getInput: () => ({ draft: 'x' }),
    context: async () => '',
    startConversation: async () => ({ subscribe() { return () => {} }, updateContext() {}, resolveAction() {}, interrupt() {}, end() {} }),
    registerActions: () => () => {},
  })
  await controller.start()
  const calls = []
  const control = { resolve(result) { calls.push(result); return true } }
  await controller.executeTool('organize_notes', {}, control)
  assert.equal(calls[0].ok, false)
  assert.match(calls[0].error, /unavailable/)
})

test('organize_notes includes the accumulated voice discussion in the curator input', async () => {
  const h = harness()
  await h.controller.start()
  // Finalized discussion transcripts accumulate for curation.
  h.emit({ type: 'transcript', role: 'input', text: '我们决定把语音助手做成三层架构', final: true })
  h.emit({ type: 'transcript', role: 'output', text: '好的，三层：传输、运行时、产品层。', final: true })
  // Interim deltas must not pollute the accumulated discussion.
  h.emit({ type: 'transcript', role: 'input', text: '未定稿的临时', final: false })
  const calls = await h.runTool('organize_notes', {})
  assert.match(calls[0].result.note, /started/)
  assert.match(h.curateCalls[0].extra, /我们决定把语音助手做成三层架构/)
  assert.match(h.curateCalls[0].extra, /ASSISTANT: 好的，三层/)
  assert.doesNotMatch(h.curateCalls[0].extra, /未定稿的临时/)
  assert.match(h.curateCalls[0].extra, /base/)
})

test('organize_notes re-injects the curation outcome into the voice-session context', async () => {
  const h = harness()
  await h.controller.start()
  await h.runTool('organize_notes', {})
  const last = h.contexts[h.contexts.length - 1]
  assert.match(last, /\[Curator notice\]/)
  assert.match(last, /1 durable-knowledge proposal/)
  assert.equal(h.controller.getSnapshot().curatorNotice.proposals, 1)
})

test('organize_notes always includes discussion and draft together (no scope switch)', async () => {
  const h = harness()
  await h.controller.start()
  h.emit({ type: 'transcript', role: 'input', text: '讨论要点', final: true })
  await h.runTool('organize_notes', {})
  assert.match(h.curateCalls[0].extra, /讨论要点/)
  assert.match(h.curateCalls[0].extra, /base/)
})

test('organize_notes sends only the discussion delta after the last successful curation', async () => {
  const h = harness()
  await h.controller.start()
  h.emit({ type: 'transcript', role: 'input', text: '第一轮讨论：确定分层架构', final: true })
  await h.runTool('organize_notes', {})
  assert.match(h.curateCalls[0].extra, /第一轮讨论/)
  // New discussion after the first successful pass.
  h.emit({ type: 'transcript', role: 'input', text: '第二轮讨论：委派知识整理', final: true })
  await h.runTool('organize_notes', {})
  assert.match(h.curateCalls[1].extra, /第二轮讨论/)
  assert.doesNotMatch(h.curateCalls[1].extra, /第一轮讨论/, 'the delta baseline excludes already-curated discussion')
  assert.match(h.curateCalls[1].extra, /base/)
})

test('a failed curation pass does not advance the delta baseline and is re-curated in full', async () => {
  const h = harness()
  await h.controller.start()
  h.emit({ type: 'transcript', role: 'input', text: '重要讨论内容', final: true })
  h.setCurateResult({ available: true, ok: false, proposals: [], currentUpdated: false, error: 'crash' })
  await h.runTool('organize_notes', {})
  assert.equal(h.controller.getSnapshot().curatorNotice.ok, false)
  h.setCurateResult({ available: true, ok: true, proposals: ['p1'], currentUpdated: true })
  await h.runTool('organize_notes', {})
  assert.match(h.curateCalls[1].extra, /重要讨论内容/, 'failed pass content is re-curated')
})
