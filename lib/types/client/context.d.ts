import type { ContextMode } from '../settings.ts';
export interface SessionSnapshotLike {
    readonly chat?: {
        readonly order?: readonly string[];
        readonly nodes?: Map<string, unknown>;
    };
}
/** Host-owned facts that let the voice frontend route work without reading the workspace itself. */
export interface SessionContextMetadata {
    readonly sessionId: string;
    readonly sessionTitle?: string;
    readonly cwd?: string;
    readonly agentPreset?: string;
    readonly workspaceId?: string;
    readonly workspaceTitle?: string;
    readonly workspacePath?: string;
}
export declare function buildBoundedContext(session: SessionSnapshotLike, draft: string, mode: ContextMode, metadata?: SessionContextMetadata): string;
export declare function messageText(session: SessionSnapshotLike, messageId: string): string;
/** One pending human-in-the-loop question asked by the primary Agent. */
export interface PendingQuestion {
    readonly callId: string;
    readonly text: string;
}
/** Find every `ask_user_question` tool call in the session snapshot with its readable text. */
export declare function questionsInSession(session: SessionSnapshotLike): PendingQuestion[];
/** Count finished assistant steps (primary-Agent turns) in the session snapshot. */
export declare function countAssistantSteps(session: SessionSnapshotLike): number;
//# sourceMappingURL=context.d.ts.map