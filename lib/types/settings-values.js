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
    openaiContextMode: 'recent',
    autoSpeak: false,
    autoSpeakMode: 'final',
    voiceName: '',
    rate: 1,
};
export const DECLARED_SETTINGS_FIELDS = Object.freeze(Object.keys(DEFAULT_SETTINGS));
export function normalizeSettings(input) {
    const source = input !== null && typeof input === 'object' && !Array.isArray(input)
        ? input
        : {};
    const provider = source.recognitionProvider;
    const language = source.recognitionLang;
    const contextMode = source.openaiContextMode;
    const speakMode = source.autoSpeakMode;
    const rate = Number(source.rate);
    const route = (field) => typeof source[field] === 'string' && /^[A-Za-z0-9._:/-]{0,180}$/.test(source[field]) ? source[field] : '';
    return {
        recognitionProvider: provider === 'browser' || provider === 'openai-realtime' || provider === 'doubao-realtime' ? provider : DEFAULT_SETTINGS.recognitionProvider,
        recognitionLang: language === 'en-US' || language === 'zh-CN' ? language : DEFAULT_SETTINGS.recognitionLang,
        openaiRealtimeModel: route('openaiRealtimeModel'),
        openaiRealtimeVoice: typeof source.openaiRealtimeVoice === 'string' && OPENAI_VOICE_IDS.has(source.openaiRealtimeVoice) ? source.openaiRealtimeVoice : DEFAULT_SETTINGS.openaiRealtimeVoice,
        doubaoRealtimeModel: route('doubaoRealtimeModel'),
        openaiContextMode: contextMode === 'off' || contextMode === 'draft' || contextMode === 'recent' ? contextMode : DEFAULT_SETTINGS.openaiContextMode,
        autoSpeak: typeof source.autoSpeak === 'boolean' ? source.autoSpeak : DEFAULT_SETTINGS.autoSpeak,
        autoSpeakMode: speakMode === 'all' || speakMode === 'final' ? speakMode : DEFAULT_SETTINGS.autoSpeakMode,
        voiceName: typeof source.voiceName === 'string' ? source.voiceName : '',
        rate: Number.isFinite(rate) ? Math.min(2, Math.max(0.5, rate)) : DEFAULT_SETTINGS.rate,
    };
}
