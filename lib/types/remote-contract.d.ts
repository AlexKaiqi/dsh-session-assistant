import { z } from 'zod';
export declare function sessionAssistantRemoteDescriptors(): ({
    id: string;
    service: string;
    namespace: string;
    method: string;
    invocation: {
        kind: "direct";
    };
    parameters: {
        name: string;
        wire: "request";
        source: "json";
        codec: {
            mode: "strict";
            typeSymbol: string;
            schema: z.ZodObject<{
                expectedRevision: z.ZodNumber;
                settings: z.ZodObject<{
                    recognitionProvider: z.ZodEnum<{
                        browser: "browser";
                        "openai-realtime": "openai-realtime";
                        "doubao-realtime": "doubao-realtime";
                        composed: "composed";
                    }>;
                    recognitionLang: z.ZodEnum<{
                        "zh-CN": "zh-CN";
                        "en-US": "en-US";
                    }>;
                    openaiRealtimeModel: z.ZodString;
                    openaiRealtimeVoice: z.ZodString;
                    doubaoRealtimeModel: z.ZodString;
                    composedAsrRoute: z.ZodString;
                    composedTtsRoute: z.ZodString;
                    composedLanguageSource: z.ZodEnum<{
                        "current-session": "current-session";
                        fixed: "fixed";
                    }>;
                    composedLanguageProvider: z.ZodString;
                    composedLanguageModel: z.ZodString;
                    openaiContextMode: z.ZodEnum<{
                        off: "off";
                        draft: "draft";
                        recent: "recent";
                    }>;
                    wakeWord: z.ZodString;
                }, z.core.$strict>;
            }, z.core.$strict>;
        };
    }[];
    result: {
        mode: "strict";
        typeSymbol: string;
        schema: z.ZodObject<{
            revision: z.ZodNumber;
            writable: z.ZodBoolean;
            settings: z.ZodObject<{
                recognitionProvider: z.ZodEnum<{
                    browser: "browser";
                    "openai-realtime": "openai-realtime";
                    "doubao-realtime": "doubao-realtime";
                    composed: "composed";
                }>;
                recognitionLang: z.ZodEnum<{
                    "zh-CN": "zh-CN";
                    "en-US": "en-US";
                }>;
                openaiRealtimeModel: z.ZodString;
                openaiRealtimeVoice: z.ZodString;
                doubaoRealtimeModel: z.ZodString;
                composedAsrRoute: z.ZodString;
                composedTtsRoute: z.ZodString;
                composedLanguageSource: z.ZodEnum<{
                    "current-session": "current-session";
                    fixed: "fixed";
                }>;
                composedLanguageProvider: z.ZodString;
                composedLanguageModel: z.ZodString;
                openaiContextMode: z.ZodEnum<{
                    off: "off";
                    draft: "draft";
                    recent: "recent";
                }>;
                wakeWord: z.ZodString;
            }, z.core.$strict>;
        }, z.core.$strict>;
    };
    sourceLocation: {
        file: string;
        line: number;
        column: number;
    };
} | {
    id: string;
    service: string;
    namespace: string;
    method: string;
    invocation: {
        kind: "direct";
    };
    parameters: {
        name: string;
        wire: "request";
        source: "json";
        codec: {
            mode: "strict";
            typeSymbol: string;
            schema: z.ZodObject<{
                query: z.ZodOptional<z.ZodString>;
                sessionId: z.ZodOptional<z.ZodString>;
                cwd: z.ZodOptional<z.ZodString>;
                maxChars: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strict>;
        };
    }[];
    result: {
        mode: "strict";
        typeSymbol: string;
        schema: z.ZodObject<{
            available: z.ZodBoolean;
            text: z.ZodString;
            sources: z.ZodArray<z.ZodString>;
        }, z.core.$strict>;
    };
    sourceLocation: {
        file: string;
        line: number;
        column: number;
    };
} | {
    id: string;
    service: string;
    namespace: string;
    method: string;
    invocation: {
        kind: "direct";
    };
    parameters: {
        name: string;
        wire: "request";
        source: "json";
        codec: {
            mode: "strict";
            typeSymbol: string;
            schema: z.ZodObject<{
                sessionId: z.ZodString;
                cwd: z.ZodOptional<z.ZodString>;
                instruction: z.ZodOptional<z.ZodString>;
                extra: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>;
        };
    }[];
    result: {
        mode: "strict";
        typeSymbol: string;
        schema: z.ZodObject<{
            available: z.ZodBoolean;
            ok: z.ZodBoolean;
            proposals: z.ZodArray<z.ZodString>;
            currentUpdated: z.ZodBoolean;
            error: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>;
    };
    sourceLocation: {
        file: string;
        line: number;
        column: number;
    };
})[];
//# sourceMappingURL=remote-contract.d.ts.map