import type { SessionAssistantSettings } from '../settings.ts';
export interface InputStateLike {
    readonly draft: string;
}
export interface InputActionsLike {
    setDraft(text: string): void;
    submit(): void;
}
export interface ToolEvent {
    type: 'tool';
    callId: string;
    name: string;
    arguments?: unknown;
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
} | ToolEvent | {
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
export interface VoiceSessionHandle {
    subscribe(listener: (event: VoiceEvent) => void): () => void;
    updateContext(context: string): void | Promise<void>;
    resolveTool(callId: string, result: unknown, options?: {
        continueResponse?: boolean;
    }): void | Promise<void>;
    interrupt(): void | Promise<void>;
    close(): void | Promise<void>;
}
export interface ControllerState {
    readonly status: 'idle' | 'opening' | 'active' | 'closed' | 'error';
    readonly phase: string;
    readonly transcript: string;
    readonly draftStatus: 'drafting' | 'ready';
    readonly error?: string | undefined;
}
export interface ControllerDependencies {
    readonly sessionId: string;
    readonly inputActions: InputActionsLike;
    readonly getInput: () => InputStateLike;
    readonly context: (draft?: string) => string | Promise<string>;
    readonly open: () => Promise<VoiceSessionHandle> | VoiceSessionHandle;
    readonly dictation?: boolean | (() => boolean);
}
export declare class VoiceController {
    private readonly deps;
    private handle;
    private unsubscribe;
    private baseline;
    private lastApplied;
    private disposed;
    private generation;
    private state;
    private readonly listeners;
    constructor(deps: ControllerDependencies);
    get sessionId(): string;
    getSnapshot(): ControllerState;
    subscribe(listener: () => void): () => void;
    start(): Promise<void>;
    stop(): Promise<void>;
    dispose(): Promise<void>;
    interrupt(): Promise<void>;
    consume(event: VoiceEvent): Promise<void>;
    private appendDictation;
    private applyTool;
    private publish;
}
export declare function providerOpenOptions(settings: SessionAssistantSettings, context: string): {
    protocol: string;
    routeId: string;
    profileId: string;
    context: string;
    language: import("../settings-values.ts").RecognitionLanguage;
};
/** Build the browser read-aloud sample from the unsaved Settings draft. */
export declare function readAloudPreviewOptions(settings: SessionAssistantSettings): {
    lang: import("../settings-values.ts").RecognitionLanguage;
    rate: number;
    voiceName?: string;
    text: string;
};
/** Open one receive-only Provider response using the actual selected Realtime voice. */
export declare function realtimeVoicePreviewOptions(settings: SessionAssistantSettings): {
    protocol: string;
    routeId: string;
    profileId: string;
    context: string;
    outputOnly: boolean;
    previewText: string;
};
//# sourceMappingURL=controller.d.ts.map