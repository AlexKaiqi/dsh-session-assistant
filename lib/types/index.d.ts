import type { Context } from '@deepseek-ai/cordis';
import type { SettingsProvider } from '@deepseek-ai/dsh-settings';
import { PROMPT } from './model/prompt.ts';
import { SESSION_ASSISTANT_PRODUCT_KNOWLEDGE } from './model/product-knowledge.ts';
import { SESSION_ASSISTANT_TOOLS, SESSION_ASSISTANT_TOOL_OUTPUT } from './model/tool-surface.ts';
import { Config, OPENAI_REALTIME_VOICES, type SessionAssistantSettings } from './settings.ts';
export { HELP, VERSION } from './help.ts';
export { Config, OPENAI_REALTIME_VOICES, PROMPT, SESSION_ASSISTANT_PRODUCT_KNOWLEDGE, SESSION_ASSISTANT_TOOLS, SESSION_ASSISTANT_TOOL_OUTPUT };
export * from './migration.ts';
export * from './settings.ts';
export * from './settings-remote.ts';
export * from './voice-pipeline.ts';
export { sessionAssistantRemoteDescriptors } from './remote-contract.ts';
export { awarenessEventsInSession, buildBoundedContext } from './client/context.ts';
export type { PlanItem, PlanItemStatus, UserAwarenessEvent } from './client/context.ts';
export declare const name = "dsh-session-assistant";
export declare const inject: string[];
export declare function realtimeEditorInstructions(context?: string): string;
export declare function openAIProfileId(voice: string): string;
export declare function sessionProfile({ id, openaiVoice }?: {
    id?: string;
    openaiVoice?: string;
}): {
    id: string;
    instructions: typeof realtimeEditorInstructions;
    tools: {
        type: string;
        name: string;
        strict: boolean;
        description: string;
        parameters: {
            type: string;
            additionalProperties: boolean;
            properties: {};
        };
    }[];
    voice: {
        openai: string;
    } | {
        openai?: never;
    };
};
export declare function previewProfile({ id, openaiVoice }?: {
    id?: string;
    openaiVoice?: string;
}): {
    id: string;
    instructions: () => string;
    tools: never[];
    voice: {
        openai: string;
    } | {
        openai?: never;
    };
};
export declare function sessionProfiles(): {
    id: string;
    instructions: typeof realtimeEditorInstructions;
    tools: {
        type: string;
        name: string;
        strict: boolean;
        description: string;
        parameters: {
            type: string;
            additionalProperties: boolean;
            properties: {};
        };
    }[];
    voice: {
        openai: string;
    } | {
        openai?: never;
    };
}[];
interface RuntimeContext extends Context {
    settings: SettingsProvider;
    realtimeModelRuntime: {
        registerProfile(profile: ReturnType<typeof sessionProfile> | ReturnType<typeof previewProfile>): () => void;
    };
}
export declare function apply(ctx: RuntimeContext, config?: Partial<SessionAssistantSettings>): void;
//# sourceMappingURL=index.d.ts.map