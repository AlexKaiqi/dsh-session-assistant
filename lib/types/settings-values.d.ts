export type RecognitionProvider = 'browser' | 'openai-realtime' | 'doubao-realtime';
export type RecognitionLanguage = 'zh-CN' | 'en-US';
export type ContextMode = 'off' | 'draft' | 'recent';
export type OpenAIRealtimeVoiceId = 'marin' | 'cedar' | 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse';
export interface SessionAssistantSettings {
    recognitionProvider: RecognitionProvider;
    recognitionLang: RecognitionLanguage;
    openaiRealtimeModel: string;
    openaiRealtimeVoice: OpenAIRealtimeVoiceId;
    doubaoRealtimeModel: string;
    openaiContextMode: ContextMode;
    /** Wake word that reactivates the voice assistant from standby; empty disables standby wake-up. */
    wakeWord: string;
}
export declare const OPENAI_REALTIME_VOICES: readonly [{
    readonly id: "marin";
    readonly name: "Marin";
    readonly recommended: true;
}, {
    readonly id: "cedar";
    readonly name: "Cedar";
    readonly recommended: true;
}, {
    readonly id: "alloy";
    readonly name: "Alloy";
}, {
    readonly id: "ash";
    readonly name: "Ash";
}, {
    readonly id: "ballad";
    readonly name: "Ballad";
}, {
    readonly id: "coral";
    readonly name: "Coral";
}, {
    readonly id: "echo";
    readonly name: "Echo";
}, {
    readonly id: "sage";
    readonly name: "Sage";
}, {
    readonly id: "shimmer";
    readonly name: "Shimmer";
}, {
    readonly id: "verse";
    readonly name: "Verse";
}];
export declare const DEFAULT_SETTINGS: SessionAssistantSettings;
export declare const DECLARED_SETTINGS_FIELDS: readonly (keyof SessionAssistantSettings)[];
export declare function normalizeSettings(input: unknown): SessionAssistantSettings;
//# sourceMappingURL=settings-values.d.ts.map