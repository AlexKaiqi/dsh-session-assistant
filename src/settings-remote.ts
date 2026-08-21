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

  private view(): SessionAssistantSettingsView {
    const descriptor = this.ctx.settings.describe({ redactSecrets: true }).find(item => item.ns === SETTINGS_NAMESPACE)
    if (descriptor === undefined) throw new Error('session-assistant settings namespace is unavailable')
    return { revision: descriptor.revision, writable: this.ctx.settings.writable, settings: structuredClone(this.scope.get()) }
  }
}
