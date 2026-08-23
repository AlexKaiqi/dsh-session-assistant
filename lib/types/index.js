import { migrateLegacySettings } from "./migration.js";
import { PROMPT } from "./model/prompt.js";
import { SESSION_ASSISTANT_TOOLS, SESSION_ASSISTANT_TOOL_OUTPUT } from "./model/tool-surface.js";
import { SessionAssistantSettingsRemote } from "./settings-remote.js";
import { Config, OPENAI_REALTIME_VOICES, registerSessionAssistantSettings } from "./settings.js";
export { HELP, VERSION } from "./help.js";
export { Config, OPENAI_REALTIME_VOICES, PROMPT, SESSION_ASSISTANT_TOOLS, SESSION_ASSISTANT_TOOL_OUTPUT };
export * from "./migration.js";
export * from "./settings.js";
export * from "./settings-remote.js";
export { buildBoundedContext } from "./client/context.js";
export const name = 'dsh-session-assistant';
export const inject = ['settings', 'realtimeModelRuntime'];
export function realtimeEditorInstructions(context = '') {
    return [PROMPT, context ? `Current projected session context and editable draft:\n${context}` : 'The editable draft is initially empty.'].join('\n\n');
}
export function openAIProfileId(voice) {
    const selected = OPENAI_REALTIME_VOICES.some(candidate => candidate.id === voice) ? voice : 'marin';
    return `session-assistant-openai-${selected}`;
}
export function sessionProfile({ id = 'session-assistant', openaiVoice } = {}) {
    return { id, instructions: realtimeEditorInstructions, tools: SESSION_ASSISTANT_TOOLS, voice: openaiVoice ? { openai: openaiVoice } : {} };
}
export function previewProfile({ id = 'session-assistant-preview', openaiVoice } = {}) {
    // The full-duplex preview behaves like the Session Assistant (same PROMPT
    // instructions) but registers no tools, so the user can ask it questions
    // without triggering any draft/submit machinery.
    return { id, instructions: realtimeEditorInstructions, tools: [], voice: openaiVoice ? { openai: openaiVoice } : {} };
}
export function sessionProfiles() {
    return [
        sessionProfile(),
        previewProfile(),
        ...OPENAI_REALTIME_VOICES.flatMap(voice => [
            sessionProfile({ id: openAIProfileId(voice.id), openaiVoice: voice.id }),
            previewProfile({ id: `session-assistant-preview-openai-${voice.id}`, openaiVoice: voice.id }),
        ]),
    ];
}
export function apply(ctx, config = {}) {
    const scope = registerSessionAssistantSettings(ctx, config);
    new SessionAssistantSettingsRemote(ctx, scope);
    ctx.effect(async () => {
        try {
            await migrateLegacySettings(ctx.settings);
        }
        catch (error) {
            ctx.logger.warn('session-assistant settings migration failed: %s', error instanceof Error ? error.message : String(error));
        }
        return () => { };
    }, 'dsh-session-assistant: legacy settings migration');
    const disposers = sessionProfiles().map(profile => ctx.realtimeModelRuntime.registerProfile(profile));
    ctx.effect(() => () => { for (const dispose of disposers.reverse())
        dispose(); }, 'dsh-session-assistant: realtime profiles');
}
