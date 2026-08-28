import type { ContextMode } from '../settings.ts';
export interface SessionNodeStoreLike {
    get(id: string): unknown;
    values?(): readonly unknown[] | Iterable<unknown>;
    entries?(): Iterable<readonly [string, unknown]>;
}
export interface SessionSnapshotLike {
    readonly running?: boolean;
    readonly chat?: {
        readonly order?: readonly string[];
        readonly nodes?: SessionNodeStoreLike;
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
/** One pending human-in-the-loop question asked by the primary Agent. */
export interface PendingQuestion {
    readonly callId: string;
    readonly text: string;
}
export type PlanItemStatus = 'pending' | 'in_progress' | 'completed';
export interface PlanItem {
    readonly content: string;
    readonly status: PlanItemStatus;
}
/**
 * Semantic events projected from the Session log. Tool names and Agent message
 * framing stay in this adapter layer; voice/UI consumers only see this small
 * user-awareness vocabulary.
 */
export type UserAwarenessEvent = {
    readonly id: string;
    readonly type: 'user_input_required';
    readonly source: 'tool';
    readonly visibility: 'user';
    readonly voicePolicy: 'interrupt';
    readonly callId: string;
    readonly text: string;
} | {
    readonly id: string;
    readonly type: 'plan_updated';
    readonly source: 'tool';
    readonly visibility: 'user';
    readonly voicePolicy: 'summary';
    readonly callId: string;
    readonly items: readonly PlanItem[];
    readonly active: readonly string[];
    readonly pending: number;
    readonly completed: number;
    readonly total: number;
    readonly phase: 'planned' | 'in_progress' | 'completed';
} | {
    readonly id: string;
    readonly type: 'agent_report';
    readonly source: 'agent';
    readonly visibility: 'internal';
    readonly voicePolicy: 'silent';
    readonly senderSessionId?: string;
    readonly text: string;
};
/** Project tool calls and delegated-Agent reports into one semantic event stream. */
export declare function awarenessEventsInSession(session: SessionSnapshotLike): UserAwarenessEvent[];
/** Find every `ask_user_question` tool call in the session snapshot with its readable text. */
export declare function questionsInSession(session: SessionSnapshotLike): PendingQuestion[];
export interface AgentFinalReply {
    readonly nodeKey: string;
    readonly turn?: number;
    readonly step?: number;
    readonly messageId?: string;
    readonly text: string;
    readonly interrupted: boolean;
}
/** Stable cursor for the latest visible terminal assistant step. */
export declare function assistantReplyCursor(session: SessionSnapshotLike): string | undefined;
/**
 * Return the final visible reply after a cursor, only once the Session turn is no
 * longer running. Tool/reasoning blocks remain in history but are never spoken.
 */
export declare function finalAgentReplyAfter(session: SessionSnapshotLike, cursor?: string): AgentFinalReply | undefined;
/** Count finished assistant steps (primary-Agent turns) in the session snapshot. */
export declare function countAssistantSteps(session: SessionSnapshotLike): number;
//# sourceMappingURL=context.d.ts.map