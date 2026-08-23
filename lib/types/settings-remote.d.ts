import type { Context } from '@deepseek-ai/cordis';
import type { SettingsScope } from '@deepseek-ai/dsh-settings';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { type SessionAssistantSettings } from './settings.ts';
export interface SessionAssistantSettingsView {
    readonly revision: number;
    readonly writable: boolean;
    readonly settings: SessionAssistantSettings;
}
export interface SaveSessionAssistantSettingsRequest {
    readonly expectedRevision: number;
    readonly settings: SessionAssistantSettings;
}
export interface SessionAssistantContextRequest {
    readonly query?: string;
    readonly sessionId?: string;
    readonly cwd?: string;
    readonly maxChars?: number;
}
export interface SessionAssistantContextView {
    readonly available: boolean;
    readonly text: string;
    readonly sources: readonly string[];
}
export interface CurateKnowledgeRequest {
    readonly sessionId: string;
    readonly cwd?: string;
    readonly instruction?: string;
    readonly extra?: string;
}
export interface CuratorView {
    readonly available: boolean;
    readonly ok: boolean;
    readonly proposals: readonly string[];
    readonly currentUpdated: boolean;
    readonly error?: string;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        sessionAssistantSettings: SessionAssistantSettingsRemote;
    }
}
export declare class SessionAssistantSettingsRemote extends TypertRemoteService {
    private readonly scope;
    constructor(ctx: Context, scope: SettingsScope<SessionAssistantSettings>);
    describe(): Promise<SessionAssistantSettingsView>;
    save(request: SaveSessionAssistantSettingsRequest): Promise<SessionAssistantSettingsView>;
    context(request: SessionAssistantContextRequest): Promise<SessionAssistantContextView>;
    /**
     * Delegate knowledge curation to the dedicated text-model curator agent
     * (personal-knowledge maintainer). Honest absence when the knowledge base
     * is not installed; failures are returned as ok:false so the voice product
     * can relay the reason instead of leaving the user waiting.
     */
    curate(request: CurateKnowledgeRequest): Promise<CuratorView>;
    private view;
}
//# sourceMappingURL=settings-remote.d.ts.map