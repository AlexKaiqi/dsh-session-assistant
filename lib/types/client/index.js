import React from 'react';
import sessionAssistantRemote from "../typert-remote.js";
import { DEFAULT_SETTINGS, OPENAI_REALTIME_VOICES } from "../settings-values.js";
import { VoiceController, providerOpenOptions } from "./controller.js";
import { buildBoundedContext, messageText } from "./context.js";
export const inject = ['slots', 'remote', 'realtimeVoice'];
function browserRecognitionSession(realtimeVoice, language) {
    let listener;
    let closed = false;
    const pending = [];
    const emit = (event) => {
        if (closed)
            return;
        if (listener)
            listener(event);
        else if (pending.length < 16)
            pending.push(event);
    };
    const recognition = realtimeVoice.recognize({
        lang: language,
        continuous: true,
        interim: true,
        onTranscript: event => emit({ type: 'transcript', role: 'input', text: event.text, final: event.final }),
        onError: error => emit({ type: 'error', message: typeof error === 'string' ? error : error.message || 'Browser recognition failed.' }),
    });
    pending.push({ type: 'phase', phase: 'listening' });
    return {
        subscribe(next) {
            listener = next;
            for (const event of pending.splice(0))
                next(event);
            return () => { if (listener === next)
                listener = undefined; };
        },
        updateContext() { },
        resolveTool() { },
        interrupt() { recognition.close(); emit({ type: 'interrupted' }); },
        close() {
            if (closed)
                return;
            recognition.close();
            emit({ type: 'closed' });
            closed = true;
            listener = undefined;
            pending.length = 0;
        },
    };
}
function useController(props) {
    const input = props.useInput(state => state);
    const session = props.useSession(state => state);
    const inputRef = React.useRef(input);
    const sessionRef = React.useRef(session);
    inputRef.current = input;
    sessionRef.current = session;
    return React.useMemo(() => props.controllerFor(props.sessionId, props.inputActions, inputRef, sessionRef), [props.sessionId, props.inputActions, props.controllerFor]);
}
function useControllerState(controller) {
    return React.useSyncExternalStore(callback => controller.subscribe(callback), () => controller.getSnapshot());
}
function MicControl(props) {
    const controller = useController(props);
    const state = useControllerState(controller);
    React.useEffect(() => () => { void controller.stop(); }, [controller]);
    const active = state.status === 'opening' || state.status === 'active';
    return React.createElement('button', {
        type: 'button', className: 'sa-icon', title: active ? '结束语音会话' : '开始语音会话', 'aria-label': active ? '结束语音会话' : '开始语音会话',
        onClick: () => { void (active ? controller.stop() : controller.start()); },
    }, active ? '结束' : '语音');
}
function VoiceDock(props) {
    const controller = useController(props);
    const state = useControllerState(controller);
    if (state.status === 'idle' || state.status === 'closed')
        return null;
    return React.createElement('section', { className: 'sa-dock' }, [
        React.createElement('div', { key: 'status', className: 'sa-dock-head' }, `${state.phase}${state.draftStatus === 'ready' ? ' · 最终稿就绪' : ''}`),
        state.transcript ? React.createElement('div', { key: 'text', className: 'sa-transcript' }, state.transcript) : null,
        state.error ? React.createElement('div', { key: 'error', className: 'sa-error' }, state.error) : null,
        state.phase === 'speaking' ? React.createElement('button', { key: 'interrupt', type: 'button', onClick: () => { void controller.interrupt(); } }, '打断') : null,
    ]);
}
function ReadAloudAction(props) {
    const session = props.useSession(state => state);
    const text = messageText(session, props.messageId || '');
    const [busy, setBusy] = React.useState(false);
    const handle = React.useRef();
    const start = React.useCallback(() => {
        if (!text || handle.current)
            return;
        const settings = props.settings();
        setBusy(true);
        const finish = () => { handle.current = undefined; setBusy(false); };
        try {
            handle.current = props.realtimeVoice.readAloud({
                text,
                ...(settings.voiceName ? { voiceName: settings.voiceName } : {}),
                lang: settings.recognitionLang,
                rate: settings.rate,
                onEnd: finish,
                onError: finish,
            });
        }
        catch {
            finish();
        }
    }, [props.realtimeVoice, props.settings, text]);
    React.useEffect(() => {
        if (props.settings().autoSpeak)
            start();
        return () => { handle.current?.interrupt(); handle.current = undefined; };
    }, [props.messageId, props.settings, start]);
    const onClick = () => {
        if (handle.current) {
            handle.current.interrupt();
            handle.current = undefined;
            setBusy(false);
        }
        else
            start();
    };
    return React.createElement('button', { type: 'button', className: 'sa-icon', disabled: !text, title: busy ? '停止朗读' : '朗读本条回复', 'aria-label': busy ? '停止朗读' : '朗读本条回复', onClick }, busy ? '停止' : '朗读');
}
function SettingsSection(props) {
    const [view, setView] = React.useState(props.view);
    const [draft, setDraft] = React.useState(props.view.settings);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState('');
    const field = (key, value) => setDraft(current => ({ ...current, [key]: value }));
    const models = props.models.filter(model => model.protocol === (draft.recognitionProvider === 'openai-realtime' ? 'openai-webrtc' : 'doubao-realtime-duplex'));
    return React.createElement('div', { className: 'sa-settings' }, [
        React.createElement('label', { key: 'provider' }, ['Provider', React.createElement('select', { value: draft.recognitionProvider, onChange: (event) => field('recognitionProvider', event.target.value) }, [
                React.createElement('option', { key: 'browser', value: 'browser' }, '浏览器识别'), React.createElement('option', { key: 'openai', value: 'openai-realtime' }, 'OpenAI Realtime'), React.createElement('option', { key: 'doubao', value: 'doubao-realtime' }, '豆包 Realtime Duplex'),
            ])]),
        React.createElement('label', { key: 'language' }, ['识别语言', React.createElement('select', { value: draft.recognitionLang, onChange: (event) => field('recognitionLang', event.target.value) }, [React.createElement('option', { key: 'zh', value: 'zh-CN' }, '中文'), React.createElement('option', { key: 'en', value: 'en-US' }, 'English')])]),
        draft.recognitionProvider !== 'browser' ? React.createElement('label', { key: 'model' }, ['实时模型', React.createElement('select', { value: draft.recognitionProvider === 'openai-realtime' ? draft.openaiRealtimeModel : draft.doubaoRealtimeModel, onChange: (event) => field(draft.recognitionProvider === 'openai-realtime' ? 'openaiRealtimeModel' : 'doubaoRealtimeModel', event.target.value) }, [React.createElement('option', { key: 'auto', value: '' }, '自动选择'), ...models.map(model => React.createElement('option', { key: model.id, value: model.id }, model.displayName || model.id))])]) : null,
        draft.recognitionProvider === 'openai-realtime' ? React.createElement('label', { key: 'voice' }, ['输出音色', React.createElement('select', { value: draft.openaiRealtimeVoice, onChange: (event) => field('openaiRealtimeVoice', event.target.value) }, OPENAI_REALTIME_VOICES.map(voice => React.createElement('option', { key: voice.id, value: voice.id }, voice.name)))]) : null,
        React.createElement('label', { key: 'context' }, ['上下文', React.createElement('select', { value: draft.openaiContextMode, onChange: (event) => field('openaiContextMode', event.target.value) }, [React.createElement('option', { key: 'recent', value: 'recent' }, '草稿与最近对话'), React.createElement('option', { key: 'draft', value: 'draft' }, '仅草稿'), React.createElement('option', { key: 'off', value: 'off' }, '关闭')])]),
        React.createElement('label', { key: 'auto' }, [React.createElement('input', { type: 'checkbox', checked: draft.autoSpeak, onChange: (event) => field('autoSpeak', event.target.checked) }), '自动朗读新回复']),
        React.createElement('label', { key: 'mode' }, ['朗读范围', React.createElement('select', { value: draft.autoSpeakMode, onChange: (event) => field('autoSpeakMode', event.target.value) }, [React.createElement('option', { key: 'final', value: 'final' }, '最终回复'), React.createElement('option', { key: 'all', value: 'all' }, '全部回复')])]),
        React.createElement('label', { key: 'readVoice' }, ['朗读音色', React.createElement('input', { value: draft.voiceName, onChange: (event) => field('voiceName', event.target.value) })]),
        React.createElement('label', { key: 'rate' }, ['朗读语速', React.createElement('input', { type: 'range', min: 0.5, max: 2, step: 0.1, value: draft.rate, onChange: (event) => field('rate', Number(event.target.value)) }), String(draft.rate)]),
        error ? React.createElement('div', { key: 'error', className: 'sa-error' }, error) : null,
        React.createElement('button', { key: 'save', type: 'button', disabled: saving || !view.writable, onClick: async () => { setSaving(true); setError(''); try {
                setView(await props.save(draft));
            }
            catch (cause) {
                setError(cause instanceof Error ? cause.message : String(cause));
            }
            finally {
                setSaving(false);
            } } }, saving ? '保存中…' : '保存设置'),
    ]);
}
const CSS = `
.sa-icon{box-sizing:border-box;min-width:44px;height:28px;padding:0 8px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-13);cursor:pointer}
.sa-icon:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.sa-icon:focus-visible{outline:2px solid var(--dsw-alias-border-l3);outline-offset:-2px}.sa-icon:disabled{opacity:.45;cursor:default}
.sa-dock{box-sizing:border-box;width:100%;max-width:var(--dsh-composer-card-max-width);margin:0 auto;padding:8px 12px;border-left:2px solid var(--dsw-alias-label-tertiary);display:flex;align-items:center;gap:10px;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-13)}
.sa-dock-head{flex:none;font-weight:600}.sa-transcript{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sa-error{color:var(--dsw-alias-state-error-primary)}
.sa-dock button,.sa-settings button{height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:transparent;color:inherit;cursor:pointer}
.sa-settings{display:grid;grid-template-columns:minmax(140px,220px) minmax(220px,1fr);gap:14px 20px;align-items:center;padding:4px 0 20px}.sa-settings label{display:contents}.sa-settings label>select,.sa-settings label>input:not([type=checkbox]){box-sizing:border-box;width:100%;min-height:32px}.sa-settings label>input[type=checkbox]{justify-self:start}.sa-settings>button,.sa-settings>.sa-error{grid-column:2}.sa-settings>button{justify-self:start}@media(max-width:700px){.sa-settings{grid-template-columns:1fr;gap:6px}.sa-settings label{display:flex;flex-direction:column;gap:6px}.sa-settings>button,.sa-settings>.sa-error{grid-column:1}}
`;
export async function apply(ctx) {
    const disposeRemote = await ctx.remote.$mount(sessionAssistantRemote);
    const remote = ctx.get('remote.sessionAssistantSettings');
    if (!remote) {
        await disposeRemote();
        throw new Error('Session Assistant settings Remote did not mount');
    }
    const realtimeVoice = ctx.realtimeVoice;
    let settingsView = { revision: 0, writable: false, settings: DEFAULT_SETTINGS };
    const initial = await remote.describe();
    if (initial.ok && initial.value)
        settingsView = initial.value;
    let models = [];
    try {
        models = await realtimeVoice.models();
    }
    catch { /* Settings remains usable without a model catalog. */ }
    ctx.effect(() => {
        const style = document.createElement('style');
        style.dataset.plugin = 'session-assistant';
        style.textContent = CSS;
        document.head.append(style);
        return () => style.remove();
    }, 'session-assistant: client styles');
    const settings = () => settingsView.settings;
    const controllers = new Map();
    const controllerFor = (sessionId, inputActions, input, session) => {
        let controller = controllers.get(sessionId);
        if (!controller) {
            controller = new VoiceController({
                sessionId,
                inputActions,
                getInput: () => input.current,
                context: draft => buildBoundedContext(session.current, draft ?? input.current.draft, settings().openaiContextMode),
                dictation: () => settings().recognitionProvider === 'browser',
                open: () => {
                    const context = buildBoundedContext(session.current, input.current.draft, settings().openaiContextMode);
                    const options = providerOpenOptions(settings(), context);
                    return settings().recognitionProvider === 'browser'
                        ? browserRecognitionSession(realtimeVoice, settings().recognitionLang)
                        : realtimeVoice.open(options);
                },
            });
            controllers.set(sessionId, controller);
        }
        return controller;
    };
    const injected = () => ({ controllerFor, settings, realtimeVoice });
    ctx.slots.inject('conversation.input.right', () => ctx.slots.register({ name: 'conversation.input.right', id: 'session-assistant-microphone', order: 60, inject: injected }, MicControl));
    ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({ name: 'conversation.input.dock', id: 'session-assistant-status', order: 60, inject: injected }, VoiceDock));
    ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({ name: 'conversation.chat.assistant-actions', id: 'session-assistant-read-aloud', order: 60, inject: injected }, ReadAloudAction));
    ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'session-assistant', order: 60, label: () => 'Session Assistant' }, () => React.createElement(SettingsSection, {
        view: settingsView,
        models,
        save: async (next) => {
            const result = await remote.save({ expectedRevision: settingsView.revision, settings: next });
            if (!result.ok || !result.value)
                throw new Error(result.error?.message || 'settings save failed');
            settingsView = result.value;
            return settingsView;
        },
    })));
    return async () => { for (const controller of controllers.values())
        await controller.dispose(); controllers.clear(); await disposeRemote(); };
}
export { VoiceController, providerOpenOptions };
