import z from '@deepseek-ai/schemastery';
import { settingsNamespace } from '@deepseek-ai/dsh-settings';
import { DEFAULT_SETTINGS, OPENAI_REALTIME_VOICES, normalizeSettings, } from "./settings-values.js";
export * from "./settings-values.js";
export const SETTINGS_NAMESPACE = settingsNamespace('session-assistant');
export const Config = z.object({
    recognitionProvider: z.union(['browser', 'openai-realtime', 'doubao-realtime', 'composed']).description('语音后端').default(DEFAULT_SETTINGS.recognitionProvider),
    recognitionLang: z.union(['zh-CN', 'en-US']).description('语音识别语言').default(DEFAULT_SETTINGS.recognitionLang),
    openaiRealtimeModel: z.string().description('OpenAI Realtime 路由；留空自动选择').default(''),
    openaiRealtimeVoice: z.union(OPENAI_REALTIME_VOICES.map(voice => voice.id)).description('OpenAI Realtime 输出音色').default('marin'),
    doubaoRealtimeModel: z.string().description('豆包 Realtime Duplex 路由；留空自动选择').default(''),
    composedAsrRoute: z.string().description('组合语音管线 ASR task 路由；必须显式选择').default(''),
    composedTtsRoute: z.string().description('组合语音管线 TTS task 路由；必须显式选择').default(''),
    composedLanguageSource: z.union(['current-session', 'fixed']).description('组合语音管线语言模型来源').default('current-session'),
    composedLanguageProvider: z.string().description('固定语言模型 Provider；使用当前 Session 时留空').default(''),
    composedLanguageModel: z.string().description('固定语言模型 ID；使用当前 Session 时留空').default(''),
    openaiContextMode: z.union(['off', 'draft', 'recent']).description('语音会话上下文范围').default('recent'),
    wakeWord: z.string().max(24).description('待机唤醒词；留空禁用待机唤醒').default('你好助手'),
});
export function registerSessionAssistantSettings(ctx, base) {
    return ctx.settings.register(SETTINGS_NAMESPACE, Config, {
        base: { ...DEFAULT_SETTINGS, ...normalizeSettings(base) },
        applies: 'live',
    });
}
