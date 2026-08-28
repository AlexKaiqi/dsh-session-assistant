import type { Context } from '@deepseek-ai/cordis'
import type { SettingsProvider } from '@deepseek-ai/dsh-settings'
import { migrateLegacySettings } from './migration.ts'
import { PROMPT } from './model/prompt.ts'
import { SESSION_ASSISTANT_PRODUCT_KNOWLEDGE } from './model/product-knowledge.ts'
import { SESSION_ASSISTANT_TOOLS, SESSION_ASSISTANT_TOOL_OUTPUT } from './model/tool-surface.ts'
import { SessionAssistantSettingsRemote } from './settings-remote.ts'
import { Config, OPENAI_REALTIME_VOICES, registerSessionAssistantSettings, type SessionAssistantSettings } from './settings.ts'
import { ComposedVoicePipelineHost } from './composed-pipeline-host.ts'
import { ComposedVoiceRemote } from './composed-voice-remote.ts'

export { HELP, VERSION } from './help.ts'
export { Config, OPENAI_REALTIME_VOICES, PROMPT, SESSION_ASSISTANT_PRODUCT_KNOWLEDGE, SESSION_ASSISTANT_TOOLS, SESSION_ASSISTANT_TOOL_OUTPUT }
export * from './migration.ts'
export * from './settings.ts'
export * from './settings-remote.ts'
export * from './voice-media.ts'
export * from './voice-pipeline.ts'
export * from './composed-pipeline-host.ts'
export * from './composed-voice-remote.ts'
export { sessionAssistantRemoteDescriptors } from './remote-contract.ts'
export { awarenessEventsInSession, buildBoundedContext } from './client/context.ts'
export type { PlanItem, PlanItemStatus, UserAwarenessEvent } from './client/context.ts'
export const name = 'dsh-session-assistant'
export const inject = ['settings', 'realtimeModelRuntime']

export function realtimeEditorInstructions(context = ''): string {
  return [PROMPT, context ? `Current projected session context and editable draft:\n${context}` : 'The editable draft is initially empty.'].join('\n\n')
}

export function openAIProfileId(voice: string): string {
  const selected = OPENAI_REALTIME_VOICES.some(candidate => candidate.id === voice) ? voice : 'marin'
  return `session-assistant-openai-${selected}`
}

export function sessionProfile({ id = 'session-assistant', openaiVoice }: { id?: string; openaiVoice?: string } = {}) {
  return { id, instructions: realtimeEditorInstructions, tools: SESSION_ASSISTANT_TOOLS, voice: openaiVoice ? { openai: openaiVoice } : {} }
}

export function previewProfile({ id = 'session-assistant-preview', openaiVoice }: { id?: string; openaiVoice?: string } = {}) {
  // OpenAI Realtime receives previewText as a user text turn. Doubao Duplex
  // needs a short injected audio cue to initiate the first response, then the
  // live microphone takes over so this becomes a guided product introduction.
  return {
    id,
    instructions: () => [
      SESSION_ASSISTANT_PRODUCT_KNOWLEDGE,
      'You are the official interactive voice tour of Session Assistant. Your identity is Session Assistant Product Guide, not a generic AI assistant. Speak in first person as the guide for this specific DSH plugin.',
      'Use the identity, positioning, capabilities, boundaries, and workflow from the shared product introduction above as authoritative knowledge. When asked who you are, what your role is, or what you can do, answer directly and concretely from it; never say you lack information about your identity or capabilities.',
      'On the first turn, proactively introduce yourself by name and positioning, summarize three or four core capabilities, state that execution is handed to the primary Agent after authorization, and invite questions about capabilities, boundaries, or recommended workflows.',
      'Treat examples, limitations, setup concepts, optional integrations, privacy, and cost as product-introduction questions. Distinguish built-in behavior from configuration-dependent availability.',
      'This tour has no tools. Do not change settings, submit work, or perform operations; explain how the operational Session Assistant and primary Agent would handle them instead.',
      'Answer in the user\'s language, keep spoken replies concise and easy to interrupt, and never invent installed models, credentials, current settings, prices, or workspace facts.',
    ].join('\n\n'),
    tools: [],
    voice: openaiVoice ? { openai: openaiVoice } : {},
  }
}

export function sessionProfiles() {
  return [
    sessionProfile(),
    previewProfile(),
    ...OPENAI_REALTIME_VOICES.flatMap(voice => [
      sessionProfile({ id: openAIProfileId(voice.id), openaiVoice: voice.id }),
      previewProfile({ id: `session-assistant-preview-openai-${voice.id}`, openaiVoice: voice.id }),
    ]),
  ]
}

interface RuntimeContext extends Context {
  settings: SettingsProvider
  realtimeModelRuntime: { registerProfile(profile: ReturnType<typeof sessionProfile> | ReturnType<typeof previewProfile>): () => void }
}

export function apply(ctx: RuntimeContext, config: Partial<SessionAssistantSettings> = {}): void {
  const composedPipeline = new ComposedVoicePipelineHost(ctx)
  new ComposedVoiceRemote(ctx, composedPipeline)
  const scope = registerSessionAssistantSettings(ctx, config)
  new SessionAssistantSettingsRemote(ctx, scope)
  ctx.effect(async () => {
    try { await migrateLegacySettings(ctx.settings) } catch (error: unknown) {
      ctx.logger.warn('session-assistant settings migration failed: %s', error instanceof Error ? error.message : String(error))
    }
    return () => {}
  }, 'dsh-session-assistant: legacy settings migration')
  const disposers = sessionProfiles().map(profile => ctx.realtimeModelRuntime.registerProfile(profile))
  ctx.effect(() => () => { for (const dispose of disposers.reverse()) dispose() }, 'dsh-session-assistant: realtime profiles')
}
