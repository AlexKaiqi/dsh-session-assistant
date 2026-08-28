export const OPENAI_REALTIME_VOICES = [
    { id: 'marin', name: 'Marin', recommended: true },
    { id: 'cedar', name: 'Cedar', recommended: true },
    { id: 'alloy', name: 'Alloy' },
    { id: 'ash', name: 'Ash' },
    { id: 'ballad', name: 'Ballad' },
    { id: 'coral', name: 'Coral' },
    { id: 'echo', name: 'Echo' },
    { id: 'sage', name: 'Sage' },
    { id: 'shimmer', name: 'Shimmer' },
    { id: 'verse', name: 'Verse' },
];
const OPENAI_VOICE_IDS = new Set(OPENAI_REALTIME_VOICES.map(voice => voice.id));
export const DEFAULT_SETTINGS = {
    recognitionProvider: 'doubao-realtime',
    recognitionLang: 'zh-CN',
    openaiRealtimeModel: '',
    openaiRealtimeVoice: 'marin',
    doubaoRealtimeModel: '',
    composedAsrRoute: '',
    composedTtsRoute: '',
    composedLanguageSource: 'current-session',
    composedLanguageProvider: '',
    composedLanguageModel: '',
    openaiContextMode: 'recent',
    wakeWord: '你好助手',
};
export const DECLARED_SETTINGS_FIELDS = Object.freeze(Object.keys(DEFAULT_SETTINGS));
export function normalizeSettings(input) {
    const source = input !== null && typeof input === 'object' && !Array.isArray(input)
        ? input
        : {};
    const provider = source.recognitionProvider;
    const language = source.recognitionLang;
    const contextMode = source.openaiContextMode;
    const route = (field) => typeof source[field] === 'string' && /^[A-Za-z0-9._:/-]{0,180}$/.test(source[field]) ? source[field] : '';
    return {
        recognitionProvider: provider === 'browser' || provider === 'openai-realtime' || provider === 'doubao-realtime' || provider === 'composed' ? provider : DEFAULT_SETTINGS.recognitionProvider,
        recognitionLang: language === 'en-US' || language === 'zh-CN' ? language : DEFAULT_SETTINGS.recognitionLang,
        openaiRealtimeModel: route('openaiRealtimeModel'),
        openaiRealtimeVoice: typeof source.openaiRealtimeVoice === 'string' && OPENAI_VOICE_IDS.has(source.openaiRealtimeVoice) ? source.openaiRealtimeVoice : DEFAULT_SETTINGS.openaiRealtimeVoice,
        doubaoRealtimeModel: route('doubaoRealtimeModel'),
        composedAsrRoute: route('composedAsrRoute'),
        composedTtsRoute: route('composedTtsRoute'),
        composedLanguageSource: source.composedLanguageSource === 'fixed' ? 'fixed' : 'current-session',
        composedLanguageProvider: route('composedLanguageProvider'),
        composedLanguageModel: route('composedLanguageModel'),
        openaiContextMode: contextMode === 'off' || contextMode === 'draft' || contextMode === 'recent' ? contextMode : DEFAULT_SETTINGS.openaiContextMode,
        wakeWord: typeof source.wakeWord === 'string' && source.wakeWord.length <= 24 ? source.wakeWord : DEFAULT_SETTINGS.wakeWord,
    };
}
