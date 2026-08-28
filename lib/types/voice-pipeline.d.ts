export type VoicePipelineKind = 'native-realtime' | 'composed';
export type VoiceStageExecution = 'request-response' | 'streaming' | 'realtime';
export interface TaskVoiceStage {
    readonly routeId: string;
    readonly execution: VoiceStageExecution;
}
export type LanguageStage = {
    readonly source: 'current-session';
} | {
    readonly source: 'fixed';
    readonly provider: string;
    readonly model: string;
};
export interface NativeRealtimeVoicePipeline {
    readonly kind: 'native-realtime';
    readonly routeId: string;
}
export interface ComposedVoicePipeline {
    readonly kind: 'composed';
    readonly asr: TaskVoiceStage;
    readonly language: LanguageStage;
    readonly tts: TaskVoiceStage;
}
export type VoicePipeline = NativeRealtimeVoicePipeline | ComposedVoicePipeline;
export type ComposedVoicePhase = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'synthesizing' | 'playing' | 'cancelled' | 'failed';
export interface ComposedVoiceTurnPorts<InputAudio, OutputAudio, Reply> {
    transcribe(audio: InputAudio, stage: TaskVoiceStage, signal: AbortSignal): Promise<string>;
    submit(text: string, stage: LanguageStage, signal: AbortSignal): Promise<Reply>;
    replyText(reply: Reply): string;
    synthesize(text: string, stage: TaskVoiceStage, signal: AbortSignal): Promise<OutputAudio>;
    play(audio: OutputAudio, signal: AbortSignal): Promise<void>;
    onPhase?(phase: ComposedVoicePhase): void;
}
/**
 * Provider-neutral turn orchestrator. It owns ordering and cancellation only;
 * task adapters own wire protocols, while the Session port owns Agent history.
 */
export declare class ComposedVoiceTurn<InputAudio, OutputAudio, Reply> {
    private controller;
    private readonly pipeline;
    private readonly ports;
    constructor(pipeline: ComposedVoicePipeline, ports: ComposedVoiceTurnPorts<InputAudio, OutputAudio, Reply>);
    cancel(): void;
    run(audio: InputAudio): Promise<Reply>;
}
export declare function composedPipeline(input: {
    asrRouteId: string;
    ttsRouteId: string;
    asrExecution?: VoiceStageExecution;
    ttsExecution?: VoiceStageExecution;
    language?: LanguageStage;
}): ComposedVoicePipeline;
//# sourceMappingURL=voice-pipeline.d.ts.map