import { z } from 'zod';
const settingsSchema = z.object({
    recognitionProvider: z.enum(['browser', 'openai-realtime', 'doubao-realtime']),
    recognitionLang: z.enum(['zh-CN', 'en-US']),
    openaiRealtimeModel: z.string(),
    openaiRealtimeVoice: z.string(),
    doubaoRealtimeModel: z.string(),
    openaiContextMode: z.enum(['off', 'draft', 'recent']),
    wakeWord: z.string(),
}).strict();
const viewSchema = z.object({
    revision: z.number(),
    writable: z.boolean(),
    settings: settingsSchema,
}).strict();
const contextViewSchema = z.object({
    available: z.boolean(),
    text: z.string(),
    sources: z.array(z.string()),
}).strict();
const curateRequestSchema = z.object({
    sessionId: z.string(),
    cwd: z.string().optional(),
    instruction: z.string().optional(),
    extra: z.string().optional(),
}).strict();
const curatorViewSchema = z.object({
    available: z.boolean(),
    ok: z.boolean(),
    proposals: z.array(z.string()),
    currentUpdated: z.boolean(),
    error: z.string().optional(),
}).strict();
export function sessionAssistantRemoteDescriptors() {
    return [
        {
            id: 'dsh-session-assistant#sessionAssistantSettings/describe',
            service: 'sessionAssistantSettings', namespace: 'sessionAssistantSettings', method: 'describe',
            invocation: { kind: 'direct' }, parameters: [],
            result: { mode: 'strict', typeSymbol: 'dsh-session-assistant#SessionAssistantSettingsView', schema: viewSchema },
            sourceLocation: { file: 'src/settings-remote.ts', line: 35, column: 3 },
        },
        {
            id: 'dsh-session-assistant#sessionAssistantSettings/save',
            service: 'sessionAssistantSettings', namespace: 'sessionAssistantSettings', method: 'save',
            invocation: { kind: 'direct' },
            parameters: [{
                    name: 'request', wire: 'request', source: 'json',
                    codec: { mode: 'strict', typeSymbol: 'dsh-session-assistant#SaveSessionAssistantSettingsRequest', schema: z.object({ expectedRevision: z.number(), settings: settingsSchema }).strict() },
                }],
            result: { mode: 'strict', typeSymbol: 'dsh-session-assistant#SessionAssistantSettingsView', schema: viewSchema },
            sourceLocation: { file: 'src/settings-remote.ts', line: 41, column: 3 },
        },
        {
            id: 'dsh-session-assistant#sessionAssistantSettings/context',
            service: 'sessionAssistantSettings', namespace: 'sessionAssistantSettings', method: 'context',
            invocation: { kind: 'direct' },
            parameters: [{
                    name: 'request', wire: 'request', source: 'json',
                    codec: { mode: 'strict', typeSymbol: 'dsh-session-assistant#SessionAssistantContextRequest', schema: z.object({ query: z.string().optional(), sessionId: z.string().optional(), cwd: z.string().optional(), maxChars: z.number().optional() }).strict() },
                }],
            result: { mode: 'strict', typeSymbol: 'dsh-session-assistant#SessionAssistantContextView', schema: contextViewSchema },
            sourceLocation: { file: 'src/settings-remote.ts', line: 47, column: 3 },
        },
        {
            id: 'dsh-session-assistant#sessionAssistantSettings/curate',
            service: 'sessionAssistantSettings', namespace: 'sessionAssistantSettings', method: 'curate',
            invocation: { kind: 'direct' },
            parameters: [{
                    name: 'request', wire: 'request', source: 'json',
                    codec: { mode: 'strict', typeSymbol: 'dsh-session-assistant#CurateKnowledgeRequest', schema: curateRequestSchema },
                }],
            result: { mode: 'strict', typeSymbol: 'dsh-session-assistant#CuratorView', schema: curatorViewSchema },
            sourceLocation: { file: 'src/settings-remote.ts', line: 53, column: 3 },
        },
    ];
}
