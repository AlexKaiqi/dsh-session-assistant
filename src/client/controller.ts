import type { SessionAssistantSettings } from '../settings.ts'
import { DECLARED_SETTINGS_FIELDS, normalizeSettings } from '../settings-values.ts'
import { awarenessEventsInSession, countAssistantSteps, type SessionContextMetadata, type SessionSnapshotLike, type UserAwarenessEvent } from './context.ts'

export interface InputStateLike { readonly draft: string }
export interface InputActionsLike { setDraft(text: string): void; submit(): void }
export interface ActionEvent { type: 'action'; callId: string; name: string; arguments?: unknown }
export type ActionName = 'update_working_draft' | 'prepare_agent_handoff' | 'submit_to_agent' | 'end_voice_session' | 'organize_notes' | 'get_assistant_settings' | 'update_assistant_settings'

export interface CurateRequest {
  readonly sessionId: string
  readonly cwd?: string
  readonly instruction?: string
  readonly extra?: string
}

export interface CurateResult {
  readonly available: boolean
  readonly ok: boolean
  readonly proposals: readonly string[]
  readonly currentUpdated: boolean
  readonly error?: string
}

/**
 * Action-control handoff from the voice conversation: the executor calls
 * `resolve` to settle the action result before running follow-up work (the
 * model keeps speaking after the result is delivered). Returns whether the
 * result was actually delivered; a closed session reports false.
 */
export interface ActionControl {
  resolve(result: unknown, options?: { continueResponse?: boolean }): boolean
}

export interface ActionExecutor {
  execute(args: unknown, control: ActionControl): unknown | Promise<unknown>
}

export interface ActionExecutorMap {
  update_working_draft: ActionExecutor
  prepare_agent_handoff: ActionExecutor
  submit_to_agent: ActionExecutor
  end_voice_session: ActionExecutor
  organize_notes: ActionExecutor
  get_assistant_settings: ActionExecutor
  update_assistant_settings: ActionExecutor
}
export type VoiceEvent =
  | { type: 'status'; connected?: boolean; status: string }
  | { type: 'phase'; phase: string }
  | { type: 'transcript'; role?: 'input' | 'output'; source?: 'input' | 'output'; text: string; final?: boolean }
  | ActionEvent
  | { type: 'interrupted' }
  | { type: 'error'; code?: string; message: string; recoverable?: boolean }
  | { type: 'closed'; reason?: string }

export interface VoiceConversation {
  subscribe(listener: (event: VoiceEvent) => void): () => void
  updateContext(context: string): void | Promise<void>
  resolveAction(callId: string, result: unknown, options?: { continueResponse?: boolean }): void | Promise<void>
  interrupt(): void | Promise<void>
  end(): void | Promise<void>
}

export interface ControllerState {
  readonly status: 'idle' | 'standby' | 'opening' | 'active' | 'closed' | 'error'
  readonly phase: string
  readonly transcript: string
  readonly draftStatus: 'drafting' | 'ready'
  /** A complete primary-Agent request is prepared but still requires explicit user authorization. */
  readonly handoff?: { readonly reason: string } | undefined
  readonly error?: string | undefined
  /** Stable transport-level error code (for example mic_not_found) kept separate from the display message. */
  readonly errorCode?: string | undefined
  /** Set once submit_to_agent hands the draft to the primary Agent; cleared on the next start/stop. */
  readonly submitNotice?: boolean | undefined
  /** The primary Agent is currently asking the human a question (human-in-the-loop). */
  readonly question?: { readonly callId: string; readonly text: string } | undefined
  /** The primary Agent produced a new reply after the voice submission. */
  readonly agentReply?: boolean | undefined
  /** Latest significant primary-Agent plan milestone projected from todo_write. */
  readonly planNotice?: Extract<UserAwarenessEvent, { type: 'plan_updated' }> | undefined
  /** Latest knowledge-curation outcome (organize_notes), announced when it lands. */
  readonly curatorNotice?: { readonly ok: boolean; readonly proposals: number; readonly error?: string } | undefined
}

export interface ControllerDependencies {
  readonly sessionId: string
  readonly inputActions: InputActionsLike
  readonly getInput: () => InputStateLike
  readonly context: (draft?: string) => string | Promise<string>
  readonly startConversation: (initialUserText?: string, initialAudio?: { readonly pcm16Base64: string; readonly sampleRate: number }) => Promise<VoiceConversation> | VoiceConversation
  readonly dictation?: boolean | (() => boolean)
  /** Called by the UI whenever the current-session snapshot changes (detects user-awareness events and replies). */
  readonly observeSession?: (snapshot: unknown) => void
  /** Read the latest current-session snapshot (for submission baseline tracking). */
  readonly getSession?: () => unknown
  /** Read Host-owned Session/workspace identity without granting workspace access. */
  readonly getSessionMetadata?: () => SessionContextMetadata
  /** Standby wake-word listening (browser recognition); enter() returns false when unavailable. */
  readonly standby?: { enter(): boolean; exit(): void }
  /**
   * Register this assistant's action executors with the voice Agent runtime
   * (voiceAgent.registerActions for this session's ownerId). The runtime
   * executes action requests and settles the results (dual output); the
   * returned disposer must run when the controller is disposed.
   */
  readonly registerActions: (tools: ActionExecutorMap) => () => void
  /**
   * Delegate knowledge curation to the dedicated curator agent. Resolves
   * immediately for the voice model; the curation result is announced when
   * it lands. Undefined when no curator remote is available.
   */
  readonly curate?: (request: CurateRequest) => Promise<CurateResult>
  /** Read and atomically update this assistant's persisted, non-secret configuration. */
  readonly getSettings?: () => SessionAssistantSettings
  readonly updateSettings?: (patch: Partial<SessionAssistantSettings>) => Promise<SessionAssistantSettings>
  /** User-facing event sink. The product may route it to UI, voice, or both. */
  readonly notifyAwareness?: (event: Exclude<UserAwarenessEvent, { visibility: 'internal' }>) => void
}

const SETTINGS_APPLICATION = {
  realtimeConnection: 'recognitionProvider, recognitionLang, openaiRealtimeModel, openaiRealtimeVoice, and doubaoRealtimeModel apply when the next voice connection starts',
  standby: 'wakeWord applies when standby is entered again; long-press the microphone button to enter standby',
  context: 'openaiContextMode applies when context is next projected into the voice session',
} as const

/** Safe configuration projection for the voice model; contains no credentials. */
export function assistantSettingsContext(settings: SessionAssistantSettings): string {
  return `[Session Assistant configuration — non-secret]\n${JSON.stringify(settings)}\nApplication rules: ${Object.values(SETTINGS_APPLICATION).join('; ')}.`
}

function parseArguments(value: unknown): Record<string, unknown> | undefined {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value !== 'string') return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined
  } catch { return undefined }
}

function errorCodeOf(error: unknown): string | undefined {
  if (error !== null && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string' && code !== '') return code
  }
  return undefined
}

/** Diagnostic tracing for the tool/submit flow; harmless no-op when the console is unavailable. */
export function saLog(detail: string, extra?: unknown): void {
  try {
    const sink = typeof console !== 'undefined' ? console : undefined
    if (sink && typeof sink.log === 'function') sink.log('[sa-controller]', detail, extra === undefined ? '' : extra)
  } catch { /* logging must never break the voice loop */ }
}

function significantPlanChange(
  previous: Extract<UserAwarenessEvent, { type: 'plan_updated' }> | undefined,
  next: Extract<UserAwarenessEvent, { type: 'plan_updated' }>,
): boolean {
  if (!previous) return true
  if (previous.phase !== next.phase || previous.completed !== next.completed || previous.total !== next.total) return true
  return previous.active.join('\n') !== next.active.join('\n')
}

export class VoiceController {
  private handle: VoiceConversation | undefined
  private unsubscribe: (() => void) | undefined
  private baseline = ''
  private lastApplied = ''
  private disposed = false
  private generation = 0
  /** Finished assistant-step count when the voice session opened (or when a submission landed). */
  private stepBaseline: number | undefined
  /** Accumulated finalized voice-discussion transcript of the current session, kept for curation. */
  private discussion = ''
  /** Discussion snapshot at the last successful curation; only the delta after it is re-curated. */
  private lastCuratedDiscussion = ''
  private readonly seenAwarenessEvents = new Set<string>()
  private lastPlan: Extract<UserAwarenessEvent, { type: 'plan_updated' }> | undefined
  private readonly disposeTools: () => void
  private state: ControllerState = { status: 'idle', phase: 'idle', transcript: '', draftStatus: 'drafting' }
  private readonly listeners = new Set<() => void>()

  constructor(private readonly deps: ControllerDependencies) {
    // Action requests are executed by the voice Agent runtime: the
    // controller only supplies executors and keeps its own state machine.
    this.disposeTools = deps.registerActions({
      update_working_draft: { execute: (args, control) => this.executeTool('update_working_draft', args, control) },
      prepare_agent_handoff: { execute: (args, control) => this.executeTool('prepare_agent_handoff', args, control) },
      submit_to_agent: { execute: (args, control) => this.executeTool('submit_to_agent', args, control) },
      end_voice_session: { execute: (args, control) => this.executeTool('end_voice_session', args, control) },
      organize_notes: { execute: (args, control) => this.executeTool('organize_notes', args, control) },
      get_assistant_settings: { execute: (args, control) => this.executeTool('get_assistant_settings', args, control) },
      update_assistant_settings: { execute: (args, control) => this.executeTool('update_assistant_settings', args, control) },
    })
  }
  get sessionId(): string { return this.deps.sessionId }
  getSnapshot(): ControllerState { return this.state }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async start(initialUserText = '', initialAudio?: { readonly pcm16Base64: string; readonly sampleRate: number }): Promise<void> {
    if (this.disposed || this.handle !== undefined || this.state.status === 'opening') return
    this.deps.standby?.exit()
    const generation = ++this.generation
    this.discussion = ''
    this.lastPlan = undefined
    this.baseline = this.deps.getInput().draft
    this.lastApplied = this.baseline
    this.publish({ status: 'opening', phase: 'connecting', transcript: '', error: undefined, errorCode: undefined, handoff: undefined, submitNotice: undefined, question: undefined, agentReply: undefined, planNotice: undefined })
    try {
      const handle = await this.deps.startConversation(initialUserText.trim().slice(0, 20_000), initialAudio)
      if (this.disposed || generation !== this.generation) { await handle.end(); return }
      this.handle = handle
      this.unsubscribe = handle.subscribe(event => { void this.consume(event).catch(error => { if (!this.disposed) this.publish({ status: 'error', error: error instanceof Error ? error.message : String(error) }) }) })
      this.publish({ status: 'active' })
      this.stepBaseline = undefined
    } catch (error: unknown) {
      if (!this.disposed && generation === this.generation) {
        this.publish({ status: 'error', error: error instanceof Error ? error.message : String(error), errorCode: errorCodeOf(error) })
      }
    }
  }

  async stop(): Promise<void> {
    if (this.disposed && this.handle === undefined) return
    ++this.generation
    this.unsubscribe?.()
    this.unsubscribe = undefined
    const handle = this.handle
    this.handle = undefined
    this.deps.standby?.exit()
    if (handle !== undefined) await handle.end()
    if (!this.disposed) this.publish({ status: 'idle', phase: 'idle', transcript: '', error: undefined, errorCode: undefined, handoff: undefined, submitNotice: undefined, question: undefined, agentReply: undefined, planNotice: undefined })
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.disposeTools()
    await this.stop()
    this.publish({ status: 'closed', phase: 'closed' })
    this.listeners.clear()
  }

  async interrupt(): Promise<void> {
    if (!this.disposed) await this.handle?.interrupt()
  }

  /** Enter wake-word standby: only the configured wake word (or the mic button) reactivates the assistant. */
  async enterStandby(): Promise<boolean> {
    if (this.disposed || this.handle !== undefined || this.state.status === 'opening') return false
    if (!this.deps.standby || !this.deps.standby.enter()) return false
    this.publish({ status: 'standby', phase: 'idle', transcript: '', error: undefined, errorCode: undefined, question: undefined, agentReply: undefined, planNotice: undefined })
    saLog('standby entered')
    return true
  }

  /** Leave standby without starting a voice session. */
  async exitStandby(): Promise<void> {
    this.deps.standby?.exit()
    if (this.state.status === 'standby') this.publish({ status: 'idle', phase: 'idle' })
  }

  /** Standby consumes the exclusive audio-input lease; any active voice session must be closed first. */
  get canEnterStandby(): boolean {
    return !this.disposed && this.handle === undefined && this.state.status !== 'opening'
  }

  /**
   * Observe the current-session snapshot (called by the UI on every session change):
   * projects tool calls and delegated-Agent messages into semantic awareness
   * events. Internal child reports remain silent; the primary Agent decides
   * whether their content becomes user-facing. Blocking questions and
   * significant plan milestones are sent to the configured UI/voice sink.
   */
  observeSession(snapshot: unknown): void {
    if (this.disposed) return
    for (const event of awarenessEventsInSession(snapshot as SessionSnapshotLike)) {
      if (this.seenAwarenessEvents.has(event.id)) continue
      this.seenAwarenessEvents.add(event.id)
      if (event.type === 'agent_report') {
        // A report wakes/informs the parent Agent. Speaking it here would let a
        // child bypass the parent's user-visibility decision.
        saLog(`subagent report received${event.senderSessionId ? ` from ${event.senderSessionId}` : ''}`)
        continue
      }
      if (event.type === 'user_input_required') {
        this.publish({ question: { callId: event.callId, text: event.text } })
        saLog(`primary-agent question ${event.callId}: ${event.text.slice(0, 120)}`)
        this.notifyAwareness(event)
        continue
      }
      const significant = significantPlanChange(this.lastPlan, event)
      this.lastPlan = event
      if (!significant) continue
      this.publish({ planNotice: event })
      saLog(`primary-agent plan ${event.callId}: ${event.completed}/${event.total} completed`)
      this.notifyAwareness(event)
    }
    const stepCount = countAssistantSteps(snapshot as SessionSnapshotLike)
    if (this.stepBaseline === undefined) this.stepBaseline = stepCount
    if (this.state.submitNotice && !this.state.agentReply && stepCount > this.stepBaseline) {
      this.publish({ agentReply: true })
      saLog('primary agent replied after submission')
    }
  }

  private notifyAwareness(event: Exclude<UserAwarenessEvent, { visibility: 'internal' }>): void {
    if (this.state.status !== 'active' || !this.deps.notifyAwareness) return
    if (event.voicePolicy === 'interrupt' && this.state.phase === 'speaking') void this.handle?.interrupt()
    try { this.deps.notifyAwareness(event) } catch { /* notification is best-effort */ }
  }

  async consume(event: VoiceEvent): Promise<void> {
    if (this.disposed) return
    if (event.type === 'status') this.publish({ status: event.connected === false || event.status === 'closed' ? 'idle' : 'active' })
    else if (event.type === 'phase') this.publish({ phase: event.phase })
    else if (event.type === 'transcript') {
      this.publish({ transcript: event.text })
      const role = event.role ?? event.source ?? 'input'
      const dictation = typeof this.deps.dictation === 'function' ? this.deps.dictation() : this.deps.dictation
      if (event.final) {
        // Accumulate the finalized discussion so organize_notes can hand the
        // voice conversation itself (not just the draft) to the curator.
        this.appendDiscussion(role, event.text)
        if (dictation && role === 'input') this.appendDictation(event.text)
      }
    } else if (event.type === 'interrupted') this.publish({ phase: 'listening' })
    else if (event.type === 'error') this.publish({ status: 'error', error: event.message, errorCode: event.code })
    else if (event.type === 'closed') {
      ++this.generation
      this.unsubscribe?.()
      this.unsubscribe = undefined
      this.handle = undefined
      this.publish({ status: 'idle', phase: 'idle' })
    }
    // Action requests are executed by the voice Agent runtime; the controller
    // only observes the remaining conversation events here.
  }

  private appendDiscussion(role: string, text: string): void {
    const addition = text.trim()
    if (!addition) return
    // Bound the accumulated discussion; curation input is capped anyway.
    const next = `${this.discussion}${this.discussion ? '\n' : ''}${role === 'output' ? 'ASSISTANT' : 'USER'}: ${addition}`
    this.discussion = next.slice(-24_000)
  }

  private appendDictation(text: string): void {
    const addition = text.trim()
    if (!addition) return
    const current = this.deps.getInput().draft
    const separator = current === '' || /\s$/.test(current) ? '' : ' '
    const draft = `${current}${separator}${addition}`
    this.deps.inputActions.setDraft(draft)
    this.baseline = draft
    this.lastApplied = draft
    this.publish({ draftStatus: 'drafting', phase: 'listening' })
  }

  /**
   * Execute one registered action through the runtime action-control handoff.
   * The runtime settles the result (control.resolve) and keeps the model
   * speaking; this method keeps the product boundaries: draft mutation only
   * through inputActions, submission only after explicit authorization, and
   * best-effort context refresh that never blocks the tool flow.
   */
  async executeTool(name: ActionName, args: unknown, control: ActionControl): Promise<void> {
    // No active voice session (stopped or never started) and disposed
    // controllers must never mutate or submit the draft.
    if (this.disposed || this.handle === undefined) return
    const parsed = parseArguments(args)
    if (parsed === undefined) {
      control.resolve({ ok: false, error: 'Invalid tool arguments.' })
      return
    }
    if (name === 'end_voice_session') {
      control.resolve({ ok: true }, { continueResponse: false })
      await this.stop()
      return
    }
    if (name === 'organize_notes') {
      await this.organizeNotes(parsed, control)
      return
    }
    if (name === 'get_assistant_settings' || name === 'update_assistant_settings') {
      await this.configureAssistant(name, parsed, control)
      return
    }
    const draft = typeof parsed.draft === 'string' ? parsed.draft : undefined
    const validUpdate = name !== 'update_working_draft'
      || typeof parsed.summary === 'string' && (parsed.status === 'drafting' || parsed.status === 'ready')
    const validHandoff = name !== 'prepare_agent_handoff'
      || typeof parsed.reason === 'string' && parsed.reason.trim() !== '' && parsed.reason.length <= 1_000
    const emptySubmit = name === 'submit_to_agent' && (draft === undefined || draft.trim() === '')
    const emptyHandoff = name === 'prepare_agent_handoff' && (draft === undefined || draft.trim() === '')
    if (draft === undefined || draft.length > 24_000 || emptySubmit || emptyHandoff || !validUpdate || !validHandoff) {
      // An empty submission would be silently ignored by the composer, so the
      // user would hear "submitted" while nothing was sent: reject it, surface
      // it in the dock, and let the voice model relay the reason too.
      this.publish({ status: 'error', errorCode: emptySubmit ? 'empty_submit' : 'invalid_action' })
      control.resolve({
        ok: false,
        error: emptySubmit
          ? 'There is no draft content to submit. Ask the user to dictate what to send first.'
          : name === 'prepare_agent_handoff'
            ? 'A non-empty draft and a short handoff reason are required.'
            : 'Invalid draft tool arguments.',
      })
      return
    }
    const current = this.deps.getInput().draft
    if (current !== this.baseline && current !== this.lastApplied) {
      this.baseline = current
      this.lastApplied = current
      control.resolve({ ok: false, error: 'The user edited the draft concurrently.', draft: current })
      return
    }
    this.deps.inputActions.setDraft(draft)
    this.baseline = draft
    this.lastApplied = draft
    const draftStatus = name === 'submit_to_agent' || name === 'prepare_agent_handoff' || parsed.status === 'ready' ? 'ready' : 'drafting'
    const handoff = name === 'prepare_agent_handoff'
      ? { reason: String(parsed.reason).trim().slice(0, 1_000) }
      : name === 'submit_to_agent' || draftStatus === 'drafting'
        ? undefined
        : this.state.handoff
    this.publish({ draftStatus, handoff, phase: 'editing' })
    saLog(`tool:${name} draftLen:${draft.length} status:${draftStatus}`)
    // Settle the tool call FIRST so the model continues speaking: Doubao
    // Duplex resumes the turn on the function-call result, and a session.update
    // sent before it can orphan the pending call and silence the follow-up.
    const settled = control.resolve(name === 'prepare_agent_handoff'
      ? { ok: true, draft, status: 'awaiting_confirmation', reason: handoff?.reason }
      : { ok: true, draft, status: draftStatus })
    if (!settled) {
      this.publish({ status: 'error', error: 'The voice session closed before the tool result could be delivered.' })
      return
    }
    if (name === 'submit_to_agent' && !this.disposed) {
      saLog('submit() -> primary Agent')
      this.deps.inputActions.submit()
      this.publish({ handoff: undefined, submitNotice: true })
      // Fresh reply baseline: the primary-Agent work that follows this submission
      // is what we announce, not anything that was already on screen.
      if (this.deps.getSession) this.stepBaseline = countAssistantSteps(this.deps.getSession() as SessionSnapshotLike)
    }
    // Next-turn context refresh is best-effort and must never block the tool
    // flow or the submission.
    try { await this.handle?.updateContext(await this.deps.context(draft)) } catch { /* knowledge/context unavailable */ }
  }

  private async configureAssistant(name: 'get_assistant_settings' | 'update_assistant_settings', parsed: Record<string, unknown>, control: ActionControl): Promise<void> {
    const current = this.deps.getSettings?.()
    if (!current) {
      control.resolve({ ok: false, error: 'Session Assistant settings are unavailable.' })
      return
    }
    if (name === 'get_assistant_settings') {
      control.resolve({ ok: true, settings: current, application: SETTINGS_APPLICATION })
      return
    }
    if (!this.deps.updateSettings) {
      control.resolve({ ok: false, error: 'Session Assistant settings are read-only.' })
      return
    }
    const patch: Partial<SessionAssistantSettings> = {}
    for (const field of DECLARED_SETTINGS_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(parsed, field)) (patch as Record<string, unknown>)[field] = parsed[field]
    }
    const fields = Object.keys(patch) as (keyof SessionAssistantSettings)[]
    if (fields.length === 0) {
      control.resolve({ ok: false, error: 'No Session Assistant setting was provided.' })
      return
    }
    const normalized = normalizeSettings({ ...current, ...patch })
    const invalid = fields.find(field => normalized[field] !== patch[field])
    if (invalid) {
      control.resolve({ ok: false, error: `Invalid value for ${invalid}.` })
      return
    }
    try {
      const settings = await this.deps.updateSettings(patch)
      const reconnectRequired = fields.some(field => field === 'recognitionProvider' || field === 'recognitionLang' || field === 'openaiRealtimeModel' || field === 'openaiRealtimeVoice' || field === 'doubaoRealtimeModel')
      const standbyRestartRequired = fields.includes('wakeWord')
      control.resolve({ ok: true, changed: fields, settings, reconnectRequired, standbyRestartRequired, application: SETTINGS_APPLICATION })
      try { await this.handle?.updateContext((await this.deps.context()).slice(0, 12_000)) } catch { /* configuration still saved */ }
    } catch (error: unknown) {
      control.resolve({ ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }

  /**
   * Delegate knowledge curation to the dedicated text-model curator agent.
   * The tool result is settled immediately (the model keeps speaking and the
   * user is told curation started); the async curation outcome is published
   * to the dock when it lands (no synthetic TTS).
   */
  private async organizeNotes(parsed: Record<string, unknown>, control: ActionControl): Promise<void> {
    if (!this.deps.curate) {
      control.resolve({ ok: false, error: 'Knowledge curation is unavailable (the knowledge base is not installed).' })
      return
    }
    const instruction = typeof parsed.instruction === 'string' ? parsed.instruction.trim().slice(0, 2_000) : ''
    const draft = this.deps.getInput().draft
    const cwd = String(this.deps.getSessionMetadata?.().cwd || '')
    // Hand the voice discussion itself (finalized transcript) plus the draft
    // to the curator: without the transcript, spoken discussion that never
    // reached the draft would be lost to curation. Only the discussion delta
    // since the last successful curation is sent (the curator already merged
    // the earlier part into current.md), unless the window rolled and the
    // snapshot no longer matches.
    const current = this.discussion
    const incremental = this.lastCuratedDiscussion && current.startsWith(this.lastCuratedDiscussion)
      ? current.slice(this.lastCuratedDiscussion.length)
      : current
    const discussion = (incremental || current).slice(-12_000)
    const extra = [discussion, draft.trim()].filter(Boolean).join('\n\n').slice(0, 12_000)
    const settled = control.resolve({ ok: true, note: 'Knowledge curation started; completion will be shown in the status bar.' })
    if (!settled) return
    this.publish({ phase: 'curating', curatorNotice: undefined })
    saLog(`organize_notes instruction:${instruction.slice(0, 120)} discussionDelta:${discussion.length}`)
    let result: CurateResult
    try {
      result = await this.deps.curate({ sessionId: this.deps.sessionId, cwd, instruction, extra })
    } catch (error: unknown) {
      result = { available: true, ok: false, proposals: [], currentUpdated: false, error: error instanceof Error ? error.message : String(error) }
    }
    if (this.disposed) return
    if (!result.available) {
      this.publish({ phase: 'listening', curatorNotice: { ok: false, proposals: 0, error: 'knowledge-base-missing' } })
      return
    }
    if (!result.ok) {
      this.publish({ phase: 'listening', curatorNotice: { ok: false, proposals: 0, error: result.error || 'curate-failed' } })
      return
    }
    // Only a successful pass advances the delta baseline; a failed pass is
    // re-curated in full on the next attempt.
    this.lastCuratedDiscussion = current.slice(-24_000)
    this.publish({ phase: 'listening', curatorNotice: { ok: true, proposals: result.proposals.length } })
    saLog(`organize_notes done proposals:${result.proposals.length} currentUpdated:${result.currentUpdated}`)
    // Re-inject the outcome into the voice-session context so the model can
    // naturally surface the result on its next turn (context evolution loop),
    // even when the dock is hidden after the session ends.
    try {
      if (this.handle) {
        const base = await this.deps.context()
        const notice = result.proposals.length > 0
          ? `Knowledge curation completed: current-work projection updated, ${result.proposals.length} durable-knowledge proposal(s) created and awaiting confirmation.`
          : 'Knowledge curation completed: current-work projection updated, no new durable-knowledge proposals.'
        const next = `${base}\n\n[Curator notice]\n${notice}`
        await this.handle.updateContext(next.slice(0, 12_000))
      }
    } catch { /* context refresh is best-effort */ }
  }

  private publish(patch: Partial<ControllerState>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }
}

export interface VoiceRouteLike { readonly id: string; readonly protocol: string; readonly available?: boolean }

const WAKE_SEPARATORS = /[\s,，。.!！?？:：;；'"“”‘’_—–…-]+/g

/** Match a configurable wake phrase without rewriting the recognized utterance. */
export function matchesWakePhrase(value: string, wakePhrase: string): boolean {
  const heard = value.toLocaleLowerCase().replace(WAKE_SEPARATORS, '')
  const phrase = wakePhrase.toLocaleLowerCase().replace(WAKE_SEPARATORS, '')
  return phrase.length > 0 && heard.includes(phrase)
}

/** Resolve the configured route, or the first callable route for the selected Realtime protocol. */
export function selectVoiceRoute(settings: SessionAssistantSettings, models: readonly VoiceRouteLike[]): string {
  if (settings.recognitionProvider === 'browser') return ''
  const configured = settings.recognitionProvider === 'openai-realtime' ? settings.openaiRealtimeModel : settings.doubaoRealtimeModel
  if (configured) return configured
  const protocol = settings.recognitionProvider === 'openai-realtime' ? 'openai-webrtc' : 'doubao-realtime-duplex'
  return models.find(model => model.protocol === protocol && model.available !== false)?.id ?? ''
}

export function voiceConversationOptions(settings: SessionAssistantSettings, context: string, routeId = '') {
  const browser = settings.recognitionProvider === 'browser'
  const openai = settings.recognitionProvider === 'openai-realtime'
  return {
    routeId: browser ? '' : routeId || (openai ? settings.openaiRealtimeModel : settings.doubaoRealtimeModel),
    profileId: openai ? `session-assistant-openai-${settings.openaiRealtimeVoice}` : 'session-assistant',
    context,
    language: settings.recognitionLang,
  }
}

/** Open an interactive audition using the selected Realtime model and voice. */
export function voiceAgentPreviewOptions(settings: SessionAssistantSettings, routeId = '') {
  const openai = settings.recognitionProvider === 'openai-realtime'
  const previewText = settings.recognitionLang === 'zh-CN'
    ? '请先简短地和我打个招呼，然后等我继续和你对话。'
    : 'Greet me briefly, then wait for me to continue the conversation.'
  return {
    routeId: routeId || (openai ? settings.openaiRealtimeModel : settings.doubaoRealtimeModel),
    profileId: openai ? `session-assistant-preview-openai-${settings.openaiRealtimeVoice}` : 'session-assistant-preview',
    outputOnly: false,
    previewText,
  }
}
