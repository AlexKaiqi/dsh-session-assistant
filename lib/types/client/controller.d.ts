import type { SessionAssistantSettings } from '../settings.ts';
import { type SessionContextMetadata, type UserAwarenessEvent } from './context.ts';
export interface InputStateLike {
    readonly draft: string;
}
export interface InputActionsLike {
    setDraft(text: string): void;
    submit(): void;
}
export interface ActionEvent {
    type: 'action';
    callId: string;
    name: string;
    arguments?: unknown;
}
export type ActionName = 'update_working_draft' | 'prepare_agent_handoff' | 'submit_to_agent' | 'end_voice_session' | 'organize_notes' | 'get_assistant_settings' | 'update_assistant_settings';
export interface CurateRequest {
    readonly sessionId: string;
    readonly cwd?: string;
    readonly instruction?: string;
    readonly extra?: string;
}
export interface CurateResult {
    readonly available: boolean;
    readonly ok: boolean;
    readonly proposals: readonly string[];
    readonly currentUpdated: boolean;
    readonly error?: string;
}
/**
 * Action-control handoff from the voice conversation: the executor calls
 * `resolve` to settle the action result before running follow-up work (the
 * model keeps speaking after the result is delivered). Returns whether the
 * result was actually delivered; a closed session reports false.
 */
export interface ActionControl {
    resolve(result: unknown, options?: {
        continueResponse?: boolean;
    }): boolean;
}
export interface ActionExecutor {
    execute(args: unknown, control: ActionControl): unknown | Promise<unknown>;
}
export interface ActionExecutorMap {
    update_working_draft: ActionExecutor;
    prepare_agent_handoff: ActionExecutor;
    submit_to_agent: ActionExecutor;
    end_voice_session: ActionExecutor;
    organize_notes: ActionExecutor;
    get_assistant_settings: ActionExecutor;
    update_assistant_settings: ActionExecutor;
}
export type VoiceEvent = {
    type: 'status';
    connected?: boolean;
    status: string;
} | {
    type: 'phase';
    phase: string;
} | {
    type: 'transcript';
    role?: 'input' | 'output';
    source?: 'input' | 'output';
    text: string;
    final?: boolean;
} | ActionEvent | {
    type: 'interrupted';
} | {
    type: 'error';
    code?: string;
    message: string;
    recoverable?: boolean;
} | {
    type: 'closed';
    reason?: string;
};
export interface VoiceConversation {
    subscribe(listener: (event: VoiceEvent) => void): () => void;
    updateContext(context: string): void | Promise<void>;
    resolveAction(callId: string, result: unknown, options?: {
        continueResponse?: boolean;
    }): void | Promise<void>;
    interrupt(): void | Promise<void>;
    end(): void | Promise<void>;
}
export interface ControllerState {
    readonly status: 'idle' | 'standby' | 'opening' | 'active' | 'closed' | 'error';
    readonly phase: string;
    readonly transcript: string;
    readonly draftStatus: 'drafting' | 'ready';
    /** A complete primary-Agent request is prepared but still requires explicit user authorization. */
    readonly handoff?: {
        readonly reason: string;
    } | undefined;
    readonly error?: string | undefined;
    /** Stable transport-level error code (for example mic_not_found) kept separate from the display message. */
    readonly errorCode?: string | undefined;
    /** Set once submit_to_agent hands the draft to the primary Agent; cleared on the next start/stop. */
    readonly submitNotice?: boolean | undefined;
    /** The primary Agent is currently asking the human a question (human-in-the-loop). */
    readonly question?: {
        readonly callId: string;
        readonly text: string;
    } | undefined;
    /** The primary Agent produced a new reply after the voice submission. */
    readonly agentReply?: boolean | undefined;
    /** Latest significant primary-Agent plan milestone projected from todo_write. */
    readonly planNotice?: Extract<UserAwarenessEvent, {
        type: 'plan_updated';
    }> | undefined;
    /** Latest knowledge-curation outcome (organize_notes), announced when it lands. */
    readonly curatorNotice?: {
        readonly ok: boolean;
        readonly proposals: number;
        readonly error?: string;
    } | undefined;
}
export interface ControllerDependencies {
    readonly sessionId: string;
    readonly inputActions: InputActionsLike;
    readonly getInput: () => InputStateLike;
    readonly context: (draft?: string) => string | Promise<string>;
    readonly startConversation: (initialUserText?: string, initialAudio?: {
        readonly pcm16Base64: string;
        readonly sampleRate: number;
    }) => Promise<VoiceConversation> | VoiceConversation;
    readonly dictation?: boolean | (() => boolean);
    /** Called by the UI whenever the current-session snapshot changes (detects user-awareness events and replies). */
    readonly observeSession?: (snapshot: unknown) => void;
    /** Read the latest current-session snapshot (for submission baseline tracking). */
    readonly getSession?: () => unknown;
    /** Read Host-owned Session/workspace identity without granting workspace access. */
    readonly getSessionMetadata?: () => SessionContextMetadata;
    /** Standby wake-word listening (browser recognition); enter() returns false when unavailable. */
    readonly standby?: {
        enter(): boolean;
        exit(): void;
    };
    /**
     * Register this assistant's action executors with the voice Agent runtime
     * (voiceAgent.registerActions for this session's ownerId). The runtime
     * executes action requests and settles the results (dual output); the
     * returned disposer must run when the controller is disposed.
     */
    readonly registerActions: (tools: ActionExecutorMap) => () => void;
    /**
     * Delegate knowledge curation to the dedicated curator agent. Resolves
     * immediately for the voice model; the curation result is announced when
     * it lands. Undefined when no curator remote is available.
     */
    readonly curate?: (request: CurateRequest) => Promise<CurateResult>;
    /** Read and atomically update this assistant's persisted, non-secret configuration. */
    readonly getSettings?: () => SessionAssistantSettings;
    readonly updateSettings?: (patch: Partial<SessionAssistantSettings>) => Promise<SessionAssistantSettings>;
    /** User-facing event sink. The product may route it to UI, voice, or both. */
    readonly notifyAwareness?: (event: Exclude<UserAwarenessEvent, {
        visibility: 'internal';
    }>) => void;
}
/** Safe configuration projection for the voice model; contains no credentials. */
export declare function assistantSettingsContext(settings: SessionAssistantSettings): string;
/** Diagnostic tracing for the tool/submit flow; harmless no-op when the console is unavailable. */
export declare function saLog(detail: string, extra?: unknown): void;
export declare class VoiceController {
    private readonly deps;
    private handle;
    private unsubscribe;
    private baseline;
    private lastApplied;
    private disposed;
    private generation;
    /** Finished assistant-step count when the voice session opened (or when a submission landed). */
    private stepBaseline;
    /** Accumulated finalized voice-discussion transcript of the current session, kept for curation. */
    private discussion;
    /** Discussion snapshot at the last successful curation; only the delta after it is re-curated. */
    private lastCuratedDiscussion;
    private readonly seenAwarenessEvents;
    private lastPlan;
    private readonly disposeTools;
    private state;
    private readonly listeners;
    constructor(deps: ControllerDependencies);
    get sessionId(): string;
    getSnapshot(): ControllerState;
    subscribe(listener: () => void): () => void;
    start(initialUserText?: string, initialAudio?: {
        readonly pcm16Base64: string;
        readonly sampleRate: number;
    }): Promise<void>;
    stop(): Promise<void>;
    dispose(): Promise<void>;
    interrupt(): Promise<void>;
    /** Enter wake-word standby: only the configured wake word (or the mic button) reactivates the assistant. */
    enterStandby(): Promise<boolean>;
    /** Leave standby without starting a voice session. */
    exitStandby(): Promise<void>;
    /** Standby consumes the exclusive audio-input lease; any active voice session must be closed first. */
    get canEnterStandby(): boolean;
    /**
     * Observe the current-session snapshot (called by the UI on every session change):
     * projects tool calls and delegated-Agent messages into semantic awareness
     * events. Internal child reports remain silent; the primary Agent decides
     * whether their content becomes user-facing. Blocking questions and
     * significant plan milestones are sent to the configured UI/voice sink.
     */
    observeSession(snapshot: unknown): void;
    private notifyAwareness;
    consume(event: VoiceEvent): Promise<void>;
    private appendDiscussion;
    private appendDictation;
    /**
     * Execute one registered action through the runtime action-control handoff.
     * The runtime settles the result (control.resolve) and keeps the model
     * speaking; this method keeps the product boundaries: draft mutation only
     * through inputActions, submission only after explicit authorization, and
     * best-effort context refresh that never blocks the tool flow.
     */
    executeTool(name: ActionName, args: unknown, control: ActionControl): Promise<void>;
    private configureAssistant;
    /**
     * Delegate knowledge curation to the dedicated text-model curator agent.
     * The tool result is settled immediately (the model keeps speaking and the
     * user is told curation started); the async curation outcome is published
     * to the dock when it lands (no synthetic TTS).
     */
    private organizeNotes;
    private publish;
}
export interface VoiceRouteLike {
    readonly id: string;
    readonly protocol: string;
    readonly available?: boolean;
}
/** Match a configurable wake phrase without rewriting the recognized utterance. */
export declare function matchesWakePhrase(value: string, wakePhrase: string): boolean;
/** Resolve the configured route, or the first callable route for the selected Realtime protocol. */
export declare function selectVoiceRoute(settings: SessionAssistantSettings, models: readonly VoiceRouteLike[]): string;
export declare function voiceConversationOptions(settings: SessionAssistantSettings, context: string, routeId?: string): {
    routeId: string;
    profileId: string;
    context: string;
    language: import("../settings-values.ts").RecognitionLanguage;
};
/** Open an interactive audition using the selected Realtime model and voice. */
export declare function voiceAgentPreviewOptions(settings: SessionAssistantSettings, routeId?: string): {
    routeId: string;
    profileId: string;
    outputOnly: boolean;
    previewText: string;
};
//# sourceMappingURL=controller.d.ts.map