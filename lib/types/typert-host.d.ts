export declare const TYPERT: {
    package: string;
    face: string;
    schemas: never[];
    invocations: ({
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
                schema: import("zod").ZodObject<{
                    expectedRevision: import("zod").ZodNumber;
                    settings: import("zod").ZodObject<{
                        recognitionProvider: import("zod").ZodEnum<{
                            browser: "browser";
                            "openai-realtime": "openai-realtime";
                            "doubao-realtime": "doubao-realtime";
                        }>;
                        recognitionLang: import("zod").ZodEnum<{
                            "zh-CN": "zh-CN";
                            "en-US": "en-US";
                        }>;
                        openaiRealtimeModel: import("zod").ZodString;
                        openaiRealtimeVoice: import("zod").ZodString;
                        doubaoRealtimeModel: import("zod").ZodString;
                        openaiContextMode: import("zod").ZodEnum<{
                            off: "off";
                            draft: "draft";
                            recent: "recent";
                        }>;
                        wakeWord: import("zod").ZodString;
                    }, import("zod/v4/core").$strict>;
                }, import("zod/v4/core").$strict>;
            };
        }[];
        result: {
            mode: "strict";
            typeSymbol: string;
            schema: import("zod").ZodObject<{
                revision: import("zod").ZodNumber;
                writable: import("zod").ZodBoolean;
                settings: import("zod").ZodObject<{
                    recognitionProvider: import("zod").ZodEnum<{
                        browser: "browser";
                        "openai-realtime": "openai-realtime";
                        "doubao-realtime": "doubao-realtime";
                    }>;
                    recognitionLang: import("zod").ZodEnum<{
                        "zh-CN": "zh-CN";
                        "en-US": "en-US";
                    }>;
                    openaiRealtimeModel: import("zod").ZodString;
                    openaiRealtimeVoice: import("zod").ZodString;
                    doubaoRealtimeModel: import("zod").ZodString;
                    openaiContextMode: import("zod").ZodEnum<{
                        off: "off";
                        draft: "draft";
                        recent: "recent";
                    }>;
                    wakeWord: import("zod").ZodString;
                }, import("zod/v4/core").$strict>;
            }, import("zod/v4/core").$strict>;
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
                schema: import("zod").ZodObject<{
                    query: import("zod").ZodOptional<import("zod").ZodString>;
                    sessionId: import("zod").ZodOptional<import("zod").ZodString>;
                    cwd: import("zod").ZodOptional<import("zod").ZodString>;
                    maxChars: import("zod").ZodOptional<import("zod").ZodNumber>;
                }, import("zod/v4/core").$strict>;
            };
        }[];
        result: {
            mode: "strict";
            typeSymbol: string;
            schema: import("zod").ZodObject<{
                available: import("zod").ZodBoolean;
                text: import("zod").ZodString;
                sources: import("zod").ZodArray<import("zod").ZodString>;
            }, import("zod/v4/core").$strict>;
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
                schema: import("zod").ZodObject<{
                    sessionId: import("zod").ZodString;
                    cwd: import("zod").ZodOptional<import("zod").ZodString>;
                    instruction: import("zod").ZodOptional<import("zod").ZodString>;
                    extra: import("zod").ZodOptional<import("zod").ZodString>;
                }, import("zod/v4/core").$strict>;
            };
        }[];
        result: {
            mode: "strict";
            typeSymbol: string;
            schema: import("zod").ZodObject<{
                available: import("zod").ZodBoolean;
                ok: import("zod").ZodBoolean;
                proposals: import("zod").ZodArray<import("zod").ZodString>;
                currentUpdated: import("zod").ZodBoolean;
                error: import("zod").ZodOptional<import("zod").ZodString>;
            }, import("zod/v4/core").$strict>;
        };
        sourceLocation: {
            file: string;
            line: number;
            column: number;
        };
    })[];
    model: {
        services: {
            description: string;
            summary: string;
            tags: never[];
            jsDoc: string;
            key: string;
            exportName: string;
            members: {
                kind: string;
                name: string;
                signature: string;
                summary: string;
            }[];
            types: never[];
        }[];
        events: never[];
        objects: never[];
    };
};
//# sourceMappingURL=typert-host.d.ts.map