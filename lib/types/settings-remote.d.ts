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
    private view;
}
//# sourceMappingURL=settings-remote.d.ts.map