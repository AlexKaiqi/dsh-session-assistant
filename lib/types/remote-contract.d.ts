import { z } from 'zod';
export declare function sessionAssistantRemoteDescriptors(): {
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
                    }>;
                    recognitionLang: z.ZodEnum<{
                        "zh-CN": "zh-CN";
                        "en-US": "en-US";
                    }>;
                    openaiRealtimeModel: z.ZodString;
                    openaiRealtimeVoice: z.ZodString;
                    doubaoRealtimeModel: z.ZodString;
                    openaiContextMode: z.ZodEnum<{
                        off: "off";
                        draft: "draft";
                        recent: "recent";
                    }>;
                    autoSpeak: z.ZodBoolean;
                    autoSpeakMode: z.ZodEnum<{
                        final: "final";
                        all: "all";
                    }>;
                    voiceName: z.ZodString;
                    rate: z.ZodNumber;
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
                }>;
                recognitionLang: z.ZodEnum<{
                    "zh-CN": "zh-CN";
                    "en-US": "en-US";
                }>;
                openaiRealtimeModel: z.ZodString;
                openaiRealtimeVoice: z.ZodString;
                doubaoRealtimeModel: z.ZodString;
                openaiContextMode: z.ZodEnum<{
                    off: "off";
                    draft: "draft";
                    recent: "recent";
                }>;
                autoSpeak: z.ZodBoolean;
                autoSpeakMode: z.ZodEnum<{
                    final: "final";
                    all: "all";
                }>;
                voiceName: z.ZodString;
                rate: z.ZodNumber;
            }, z.core.$strict>;
        }, z.core.$strict>;
    };
    sourceLocation: {
        file: string;
        line: number;
        column: number;
    };
}[];
//# sourceMappingURL=remote-contract.d.ts.map