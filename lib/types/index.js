import { migrateLegacySettings } from "./migration.js";
import { PROMPT } from "./model/prompt.js";
import { SESSION_ASSISTANT_PRODUCT_KNOWLEDGE } from "./model/product-knowledge.js";
import { SESSION_ASSISTANT_TOOLS, SESSION_ASSISTANT_TOOL_OUTPUT } from "./model/tool-surface.js";
import { SessionAssistantSettingsRemote } from "./settings-remote.js";
import { Config, OPENAI_REALTIME_VOICES, registerSessionAssistantSettings } from "./settings.js";
import { ComposedVoicePipelineHost } from "./composed-pipeline-host.js";
import { ComposedVoiceRemote } from "./composed-voice-remote.js";
export { HELP, VERSION } from "./help.js";
export { Config, OPENAI_REALTIME_VOICES, PROMPT, SESSION_ASSISTANT_PRODUCT_KNOWLEDGE, SESSION_ASSISTANT_TOOLS, SESSION_ASSISTANT_TOOL_OUTPUT };
export * from "./migration.js";
export * from "./settings.js";
export * from "./settings-remote.js";
export * from "./voice-media.js";
export * from "./voice-pipeline.js";
export * from "./composed-pipeline-host.js";
export * from "./composed-voice-remote.js";
export { sessionAssistantRemoteDescriptors } from "./remote-contract.js";
export { awarenessEventsInSession, buildBoundedContext } from "./client/context.js";
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
    // OpenAI Realtime receives previewText as a user text turn. Doubao Duplex
    // needs a short injected audio cue to initiate the first response, then the
    // live microphone takes over so this becomes a guided product introduction.
    return {
        id,
        instructions: () => [
            SESSION_ASSISTANT_PRODUCT_KNOWLEDGE,
            'You are the official interactive voice tour of Session Assistant. Your identity is Session Assistant Product Guide, not a generic AI assistant. Speak in first person as the guide for this specific DSH plugin.',
            'Use the identity, positioning, capabilities, boundaries, and workflow from the shared product introduction above as authoritative knowledge. When asked who you are, what your role is, or what you can do, answer directly and concretely from it; never say you lack information about your identity or capabilities.',
            'On the first turn, proactively introduce yourself by name and positioning, summarize three or four core capabilities, state that execution is handed to the primary Agent after authorization, and invite questions about capabilities, boundaries, or recommended workflows.',
            'Treat examples, limitations, setup concepts, optional integrations, privacy, and cost as product-introduction questions. Distinguish built-in behavior from configuration-dependent availability.',
            'This tour has no tools. Do not change settings, submit work, or perform operations; explain how the operational Session Assistant and primary Agent would handle them instead.',
            'Answer in the user\'s language, keep spoken replies concise and easy to interrupt, and never invent installed models, credentials, current settings, prices, or workspace facts.',
        ].join('\n\n'),
        tools: [],
        voice: openaiVoice ? { openai: openaiVoice } : {},
    };
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
    const composedPipeline = new ComposedVoicePipelineHost(ctx);
    new ComposedVoiceRemote(ctx, composedPipeline);
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
