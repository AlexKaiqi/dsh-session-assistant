import type { SessionAssistantSettings } from '../settings.ts'
import { countAssistantSteps, questionsInSession, type SessionSnapshotLike } from './context.ts'

export interface InputStateLike { readonly draft: string }
export interface InputActionsLike { setDraft(text: string): void; submit(): void }
export interface ToolEvent { type: 'tool'; callId: string; name: string; arguments?: unknown }
export type ToolName = 'update_working_draft' | 'submit_to_agent' | 'end_voice_session' | 'organize_notes'

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
 * Tool-control handoff from the runtime tool registry: the executor calls
 * `resolve` to settle the tool result before running follow-up work (the
 * model keeps speaking after the result is delivered). Returns whether the
 * result was actually delivered; a closed session reports false.
 */
export interface ToolControl {
  resolve(result: unknown, options?: { continueResponse?: boolean }): boolean
}

export interface ToolExecutor {
  execute(args: unknown, control: ToolControl): unknown | Promise<unknown>
}

export interface ToolExecutorMap {
  update_working_draft: ToolExecutor
  submit_to_agent: ToolExecutor
  end_voice_session: ToolExecutor
  organize_notes: ToolExecutor
}
export type VoiceEvent =
  | { type: 'status'; connected?: boolean; status: string }
  | { type: 'phase'; phase: string }
  | { type: 'transcript'; role?: 'input' | 'output'; source?: 'input' | 'output'; text: string; final?: boolean }
  | ToolEvent
  | { type: 'interrupted' }
  | { type: 'error'; code?: string; message: string; recoverable?: boolean }
  | { type: 'closed'; reason?: string }

export interface VoiceSessionHandle {
  subscribe(listener: (event: VoiceEvent) => void): () => void
  updateContext(context: string): void | Promise<void>
  resolveTool(callId: string, result: unknown, options?: { continueResponse?: boolean }): void | Promise<void>
  interrupt(): void | Promise<void>
  close(): void | Promise<void>
}

export interface ControllerState {
  readonly status: 'idle' | 'standby' | 'opening' | 'active' | 'closed' | 'error'
  readonly phase: string
  readonly transcript: string
  readonly draftStatus: 'drafting' | 'ready'
  readonly error?: string | undefined
  /** Stable transport-level error code (for example mic_not_found) kept separate from the display message. */
  readonly errorCode?: string | undefined
  /** Set once submit_to_agent hands the draft to the primary Agent; cleared on the next start/stop. */
  readonly submitNotice?: boolean | undefined
  /** The primary Agent is currently asking the human a question (human-in-the-loop). */
  readonly question?: { readonly callId: string; readonly text: string } | undefined
  /** The primary Agent produced a new reply after the voice submission. */
  readonly agentReply?: boolean | undefined
  /** Latest knowledge-curation outcome (organize_notes), announced when it lands. */
  readonly curatorNotice?: { readonly ok: boolean; readonly proposals: number; readonly error?: string } | undefined
}

export interface ControllerDependencies {
  readonly sessionId: string
  readonly inputActions: InputActionsLike
  readonly getInput: () => InputStateLike
  readonly context: (draft?: string) => string | Promise<string>
  readonly open: () => Promise<VoiceSessionHandle> | VoiceSessionHandle
  readonly dictation?: boolean | (() => boolean)
  /** Called by the UI whenever the current-session snapshot changes (detects primary-Agent questions and replies). */
  readonly observeSession?: (snapshot: unknown) => void
  /** Read the latest current-session snapshot (for submission baseline tracking). */
  readonly getSession?: () => unknown
  /** Standby wake-word listening (browser recognition); enter() returns false when unavailable. */
  readonly standby?: { enter(): boolean; exit(): void }
  /**
   * Register this assistant's tool executors with the runtime tool registry
   * (realtimeVoice.registerTools for this session's ownerId). The runtime
   * executes tool events itself and settles the results (dual output); the
   * returned disposer must run when the controller is disposed.
   */
  readonly registerTools: (tools: ToolExecutorMap) => () => void
  /**
   * Delegate knowledge curation to the dedicated curator agent. Resolves
   * immediately for the voice model; the curation result is announced when
   * it lands. Undefined when no curator remote is available.
   */
  readonly curate?: (request: CurateRequest) => Promise<CurateResult>
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

export class VoiceController {
  private handle: VoiceSessionHandle | undefined
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
  private readonly seenQuestions = new Set<string>()
  private readonly disposeTools: () => void
  private state: ControllerState = { status: 'idle', phase: 'idle', transcript: '', draftStatus: 'drafting' }
  private readonly listeners = new Set<() => void>()

  constructor(private readonly deps: ControllerDependencies) {
    // Tool events are executed by the realtime runtime (tool registry): the
    // controller only supplies executors and keeps its own state machine.
    this.disposeTools = deps.registerTools({
      update_working_draft: { execute: (args, control) => this.executeTool('update_working_draft', args, control) },
      submit_to_agent: { execute: (args, control) => this.executeTool('submit_to_agent', args, control) },
      end_voice_session: { execute: (args, control) => this.executeTool('end_voice_session', args, control) },
      organize_notes: { execute: (args, control) => this.executeTool('organize_notes', args, control) },
    })
  }
  get sessionId(): string { return this.deps.sessionId }
  getSnapshot(): ControllerState { return this.state }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async start(): Promise<void> {
    if (this.disposed || this.handle !== undefined || this.state.status === 'opening') return
    this.deps.standby?.exit()
    const generation = ++this.generation
    this.discussion = ''
    this.baseline = this.deps.getInput().draft
    this.lastApplied = this.baseline
    this.publish({ status: 'opening', phase: 'connecting', transcript: '', error: undefined, errorCode: undefined, submitNotice: undefined, question: undefined, agentReply: undefined })
    try {
      const handle = await this.deps.open()
      if (this.disposed || generation !== this.generation) { await handle.close(); return }
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
    if (handle !== undefined) await handle.close()
    if (!this.disposed) this.publish({ status: 'idle', phase: 'idle', transcript: '', error: undefined, errorCode: undefined, submitNotice: undefined, question: undefined, agentReply: undefined })
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
    this.publish({ status: 'standby', phase: 'idle', transcript: '', error: undefined, errorCode: undefined, question: undefined, agentReply: undefined })
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
   * surfaces primary-Agent human-in-the-loop questions and reply completion in the
   * status bar — no synthetic TTS announcements.
   */
  observeSession(snapshot: unknown): void {
    if (this.disposed) return
    const questions = questionsInSession(snapshot as SessionSnapshotLike)
    for (const question of questions) {
      if (this.seenQuestions.has(question.callId)) continue
      this.seenQuestions.add(question.callId)
      this.publish({ question })
      saLog(`primary-agent question ${question.callId}: ${question.text.slice(0, 120)}`)
      break
    }
    const stepCount = countAssistantSteps(snapshot as SessionSnapshotLike)
    if (this.stepBaseline === undefined) this.stepBaseline = stepCount
    if (this.state.submitNotice && !this.state.agentReply && stepCount > this.stepBaseline) {
      this.publish({ agentReply: true })
      saLog('primary agent replied after submission')
    }
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
    // Tool events are executed by the realtime runtime through the tool
    // registry; the controller only observes the remaining voice events here.
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
   * Execute one registered tool through the runtime tool-control handoff.
   * The runtime settles the result (control.resolve) and keeps the model
   * speaking; this method keeps the product boundaries: draft mutation only
   * through inputActions, submission only after explicit authorization, and
   * best-effort context refresh that never blocks the tool flow.
   */
  async executeTool(name: ToolName, args: unknown, control: ToolControl): Promise<void> {
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
    const draft = typeof parsed.draft === 'string' ? parsed.draft : undefined
    const validUpdate = name !== 'update_working_draft'
      || typeof parsed.summary === 'string' && (parsed.status === 'drafting' || parsed.status === 'ready')
    const emptySubmit = name === 'submit_to_agent' && (draft === undefined || draft.trim() === '')
    if (draft === undefined || draft.length > 24_000 || emptySubmit || !validUpdate) {
      // An empty submission would be silently ignored by the composer, so the
      // user would hear "submitted" while nothing was sent: reject it, surface
      // it in the dock, and let the voice model relay the reason too.
      this.publish({ status: 'error', errorCode: 'empty_submit' })
      control.resolve({
        ok: false,
        error: emptySubmit
          ? 'There is no draft content to submit. Ask the user to dictate what to send first.'
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
    const draftStatus = name === 'submit_to_agent' || parsed.status === 'ready' ? 'ready' : 'drafting'
    this.publish({ draftStatus, phase: 'editing' })
    saLog(`tool:${name} draftLen:${draft.length} status:${draftStatus}`)
    // Settle the tool call FIRST so the model continues speaking: Doubao
    // Duplex resumes the turn on the function-call result, and a session.update
    // sent before it can orphan the pending call and silence the follow-up.
    const settled = control.resolve({ ok: true, draft, status: draftStatus })
    if (!settled) {
      this.publish({ status: 'error', error: 'The voice session closed before the tool result could be delivered.' })
      return
    }
    if (name === 'submit_to_agent' && !this.disposed) {
      saLog('submit() -> primary Agent')
      this.deps.inputActions.submit()
      this.publish({ submitNotice: true })
      // Fresh reply baseline: the primary-Agent work that follows this submission
      // is what we announce, not anything that was already on screen.
      if (this.deps.getSession) this.stepBaseline = countAssistantSteps(this.deps.getSession() as SessionSnapshotLike)
    }
    // Next-turn context refresh is best-effort and must never block the tool
    // flow or the submission.
    try { await this.handle?.updateContext(await this.deps.context(draft)) } catch { /* knowledge/context unavailable */ }
  }

  /**
   * Delegate knowledge curation to the dedicated text-model curator agent.
   * The tool result is settled immediately (the model keeps speaking and the
   * user is told curation started); the async curation outcome is published
   * to the dock when it lands (no synthetic TTS).
   */
  private async organizeNotes(parsed: Record<string, unknown>, control: ToolControl): Promise<void> {
    if (!this.deps.curate) {
      control.resolve({ ok: false, error: 'Knowledge curation is unavailable (the knowledge base is not installed).' })
      return
    }
    const instruction = typeof parsed.instruction === 'string' ? parsed.instruction.trim().slice(0, 2_000) : ''
    const draft = this.deps.getInput().draft
    const withMeta = this.deps.getSession?.() as { header?: { cwd?: string }; cwd?: string } | undefined
    const cwd = String(withMeta?.header?.cwd || withMeta?.cwd || '')
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

export function providerOpenOptions(settings: SessionAssistantSettings, context: string) {
  const browser = settings.recognitionProvider === 'browser'
  const openai = settings.recognitionProvider === 'openai-realtime'
  return {
    protocol: browser ? 'browser-recognition' : openai ? 'openai-webrtc' : 'doubao-realtime-duplex',
    routeId: browser ? '' : openai ? settings.openaiRealtimeModel : settings.doubaoRealtimeModel,
    profileId: openai ? `session-assistant-openai-${settings.openaiRealtimeVoice}` : 'session-assistant',
    context,
    language: settings.recognitionLang,
  }
}

/** Open a full-duplex preview session using the actual selected Realtime model/voice. */
export function realtimeVoicePreviewOptions(settings: SessionAssistantSettings) {
  const openai = settings.recognitionProvider === 'openai-realtime'
  return {
    protocol: openai ? 'openai-webrtc' : 'doubao-realtime-duplex',
    routeId: openai ? settings.openaiRealtimeModel : settings.doubaoRealtimeModel,
    profileId: openai ? `session-assistant-preview-openai-${settings.openaiRealtimeVoice}` : 'session-assistant-preview',
  }
}
