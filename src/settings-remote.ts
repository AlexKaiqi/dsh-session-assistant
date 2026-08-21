import type { Context } from '@deepseek-ai/cordis'
import type { SettingsScope } from '@deepseek-ai/dsh-settings'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { SETTINGS_NAMESPACE, normalizeSettings, type SessionAssistantSettings } from './settings.ts'

export interface SessionAssistantSettingsView {
  readonly revision: number
  readonly writable: boolean
  readonly settings: SessionAssistantSettings
}

export interface SaveSessionAssistantSettingsRequest {
  readonly expectedRevision: number
  readonly settings: SessionAssistantSettings
}

export interface SessionAssistantContextRequest {
  readonly query?: string
  readonly sessionId?: string
  readonly cwd?: string
  readonly maxChars?: number
}

export interface SessionAssistantContextView {
  readonly available: boolean
  readonly text: string
  readonly sources: readonly string[]
}

interface PersonalKnowledgeLike {
  project(options: { query?: string; sessionId?: string; cwd?: string; maxChars?: number }): Promise<{ text?: string; sources?: readonly string[] }> | { text?: string; sources?: readonly string[] }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    sessionAssistantSettings: SessionAssistantSettingsRemote
  }
}

export class SessionAssistantSettingsRemote extends TypertRemoteService {
  constructor(ctx: Context, private readonly scope: SettingsScope<SessionAssistantSettings>) {
    super(ctx, 'sessionAssistantSettings')
  }

  @Remote('describe')
  async describe(): Promise<SessionAssistantSettingsView> {
    return this.view()
  }

  @Remote('save')
  async save(request: SaveSessionAssistantSettingsRequest): Promise<SessionAssistantSettingsView> {
    await this.ctx.settings.replace(SETTINGS_NAMESPACE, normalizeSettings(request.settings), request.expectedRevision)
    return this.view()
  }

  @Remote('context')
  async context(request: SessionAssistantContextRequest): Promise<SessionAssistantContextView> {
    const knowledge = this.ctx.get('personalKnowledge') as PersonalKnowledgeLike | undefined
    if (knowledge === undefined) return { available: false, text: '', sources: [] }
    const projection = await knowledge.project({
      query: String(request.query || '').slice(0, 2_400),
      sessionId: String(request.sessionId || '').slice(0, 160),
      cwd: String(request.cwd || '').slice(0, 2_000),
      maxChars: Math.max(1_000, Math.min(12_000, Number(request.maxChars) || 6_000)),
    })
    return {
      available: true,
      text: typeof projection.text === 'string' ? projection.text.slice(0, 12_000) : '',
      sources: Array.isArray(projection.sources) ? projection.sources.map(String).slice(0, 40) : [],
    }
  }

  private view(): SessionAssistantSettingsView {
    const descriptor = this.ctx.settings.describe({ redactSecrets: true }).find(item => item.ns === SETTINGS_NAMESPACE)
    if (descriptor === undefined) throw new Error('session-assistant settings namespace is unavailable')
    return { revision: descriptor.revision, writable: this.ctx.settings.writable, settings: structuredClone(this.scope.get()) }
  }
}
