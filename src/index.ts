import type { Context } from '@deepseek-ai/cordis'
import type { SettingsProvider } from '@deepseek-ai/dsh-settings'
import { migrateLegacySettings } from './migration.ts'
import { PROMPT } from './model/prompt.ts'
import { SESSION_ASSISTANT_TOOLS, SESSION_ASSISTANT_TOOL_OUTPUT } from './model/tool-surface.ts'
import { SessionAssistantSettingsRemote } from './settings-remote.ts'
import { Config, OPENAI_REALTIME_VOICES, registerSessionAssistantSettings, type SessionAssistantSettings } from './settings.ts'

export { HELP, VERSION } from './help.ts'
export { Config, OPENAI_REALTIME_VOICES, PROMPT, SESSION_ASSISTANT_TOOLS, SESSION_ASSISTANT_TOOL_OUTPUT }
export * from './migration.ts'
export * from './settings.ts'
export * from './settings-remote.ts'
export { buildBoundedContext } from './client/context.ts'
export const name = 'dsh-session-assistant'
export const inject = ['settings', 'realtimeModelRuntime']

export function realtimeEditorInstructions(context = ''): string {
  return [PROMPT, context ? `Current projected session context and editable draft:\n${context}` : 'The editable draft is initially empty.'].join('\n\n')
}

export function realtimePreviewInstructions(sample = ''): string {
  return [
    'You are a voice preview. Speak exactly one short sample sentence, then stop. Do not ask questions, call tools, mention settings, or continue the conversation.',
    sample ? `Exact sample sentence:\n${sample}` : 'Say a brief friendly greeting.',
  ].join('\n\n')
}

export function openAIProfileId(voice: string): string {
  const selected = OPENAI_REALTIME_VOICES.some(candidate => candidate.id === voice) ? voice : 'marin'
  return `session-assistant-openai-${selected}`
}

export function sessionProfile({ id = 'session-assistant', openaiVoice }: { id?: string; openaiVoice?: string } = {}) {
  return { id, instructions: realtimeEditorInstructions, tools: SESSION_ASSISTANT_TOOLS, voice: openaiVoice ? { openai: openaiVoice } : {} }
}

export function previewProfile({ id = 'session-assistant-preview', openaiVoice }: { id?: string; openaiVoice?: string } = {}) {
  return { id, instructions: realtimePreviewInstructions, tools: [], voice: openaiVoice ? { openai: openaiVoice } : {} }
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
