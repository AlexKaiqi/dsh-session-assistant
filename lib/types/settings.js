import z from '@deepseek-ai/schemastery';
import { settingsNamespace } from '@deepseek-ai/dsh-settings';
import { DEFAULT_SETTINGS, OPENAI_REALTIME_VOICES, normalizeSettings, } from "./settings-values.js";
export * from "./settings-values.js";
export const SETTINGS_NAMESPACE = settingsNamespace('session-assistant');
export const Config = z.object({
    recognitionProvider: z.union(['browser', 'openai-realtime', 'doubao-realtime']).description('语音后端').default(DEFAULT_SETTINGS.recognitionProvider),
    recognitionLang: z.union(['zh-CN', 'en-US']).description('语音识别语言').default(DEFAULT_SETTINGS.recognitionLang),
    openaiRealtimeModel: z.string().description('OpenAI Realtime 路由；留空自动选择').default(''),
    openaiRealtimeVoice: z.union(OPENAI_REALTIME_VOICES.map(voice => voice.id)).description('OpenAI Realtime 输出音色').default('marin'),
    doubaoRealtimeModel: z.string().description('豆包 Realtime Duplex 路由；留空自动选择').default(''),
    openaiContextMode: z.union(['off', 'draft', 'recent']).description('语音会话上下文范围').default('recent'),
    autoSpeak: z.boolean().description('自动朗读主 Agent 的新回复').default(false),
    autoSpeakMode: z.union(['final', 'all']).description('主 Agent 回复朗读范围').default('final'),
    voiceName: z.string().description('朗读音色；留空自动选择').default(''),
    rate: z.number().min(0.5).max(2).description('朗读语速').default(1),
});
export function registerSessionAssistantSettings(ctx, base) {
    return ctx.settings.register(SETTINGS_NAMESPACE, Config, {
        base: { ...DEFAULT_SETTINGS, ...normalizeSettings(base) },
        applies: 'live',
    });
}
