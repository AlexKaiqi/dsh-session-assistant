function parseArguments(value) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value))
        return value;
    if (typeof value !== 'string')
        return undefined;
    try {
        const parsed = JSON.parse(value);
        return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
    }
    catch {
        return undefined;
    }
}
export class VoiceController {
    deps;
    handle;
    unsubscribe;
    baseline = '';
    lastApplied = '';
    disposed = false;
    generation = 0;
    state = { status: 'idle', phase: 'idle', transcript: '', draftStatus: 'drafting' };
    listeners = new Set();
    constructor(deps) {
        this.deps = deps;
    }
    get sessionId() { return this.deps.sessionId; }
    getSnapshot() { return this.state; }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    async start() {
        if (this.disposed || this.handle !== undefined || this.state.status === 'opening')
            return;
        const generation = ++this.generation;
        this.baseline = this.deps.getInput().draft;
        this.lastApplied = this.baseline;
        this.publish({ status: 'opening', phase: 'connecting', transcript: '', error: undefined });
        try {
            const handle = await this.deps.open();
            if (this.disposed || generation !== this.generation) {
                await handle.close();
                return;
            }
            this.handle = handle;
            this.unsubscribe = handle.subscribe(event => { void this.consume(event); });
            this.publish({ status: 'active' });
        }
        catch (error) {
            if (!this.disposed && generation === this.generation) {
                this.publish({ status: 'error', error: error instanceof Error ? error.message : String(error) });
            }
        }
    }
    async stop() {
        if (this.disposed && this.handle === undefined)
            return;
        ++this.generation;
        this.unsubscribe?.();
        this.unsubscribe = undefined;
        const handle = this.handle;
        this.handle = undefined;
        if (handle !== undefined)
            await handle.close();
        if (!this.disposed)
            this.publish({ status: 'idle', phase: 'idle', transcript: '', error: undefined });
    }
    async dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        await this.stop();
        this.publish({ status: 'closed', phase: 'closed' });
        this.listeners.clear();
    }
    async interrupt() {
        if (!this.disposed)
            await this.handle?.interrupt();
    }
    async consume(event) {
        if (this.disposed)
            return;
        if (event.type === 'status')
            this.publish({ status: event.connected === false || event.status === 'closed' ? 'idle' : 'active' });
        else if (event.type === 'phase')
            this.publish({ phase: event.phase });
        else if (event.type === 'transcript') {
            this.publish({ transcript: event.text });
            const dictation = typeof this.deps.dictation === 'function' ? this.deps.dictation() : this.deps.dictation;
            if (dictation && event.final && (event.role ?? event.source ?? 'input') === 'input')
                this.appendDictation(event.text);
        }
        else if (event.type === 'interrupted')
            this.publish({ phase: 'listening' });
        else if (event.type === 'error')
            this.publish({ status: 'error', error: event.message });
        else if (event.type === 'closed') {
            ++this.generation;
            this.unsubscribe?.();
            this.unsubscribe = undefined;
            this.handle = undefined;
            this.publish({ status: 'idle', phase: 'idle' });
        }
        else if (event.type === 'tool')
            await this.applyTool(event);
    }
    appendDictation(text) {
        const addition = text.trim();
        if (!addition)
            return;
        const current = this.deps.getInput().draft;
        const separator = current === '' || /\s$/.test(current) ? '' : ' ';
        const draft = `${current}${separator}${addition}`;
        this.deps.inputActions.setDraft(draft);
        this.baseline = draft;
        this.lastApplied = draft;
        this.publish({ draftStatus: 'drafting', phase: 'listening' });
    }
    async applyTool(event) {
        if (this.disposed || this.handle === undefined)
            return;
        const args = parseArguments(event.arguments);
        if (args === undefined) {
            await this.handle.resolveTool(event.callId, { ok: false, error: 'Invalid tool arguments.' });
            return;
        }
        if (event.name === 'end_voice_session') {
            await this.handle.resolveTool(event.callId, { ok: true }, { continueResponse: false });
            await this.stop();
            return;
        }
        if (event.name !== 'update_working_draft' && event.name !== 'submit_to_agent') {
            await this.handle.resolveTool(event.callId, { ok: false, error: 'Unsupported tool.' });
            return;
        }
        const draft = typeof args.draft === 'string' ? args.draft : undefined;
        const validUpdate = event.name !== 'update_working_draft'
            || typeof args.summary === 'string' && (args.status === 'drafting' || args.status === 'ready');
        if (draft === undefined || draft.length > 24_000 || !validUpdate) {
            await this.handle.resolveTool(event.callId, { ok: false, error: 'Invalid draft tool arguments.' });
            return;
        }
        const current = this.deps.getInput().draft;
        if (current !== this.baseline && current !== this.lastApplied) {
            this.baseline = current;
            this.lastApplied = current;
            await this.handle.resolveTool(event.callId, { ok: false, error: 'The user edited the draft concurrently.', draft: current });
            return;
        }
        this.deps.inputActions.setDraft(draft);
        this.baseline = draft;
        this.lastApplied = draft;
        const draftStatus = event.name === 'submit_to_agent' || args.status === 'ready' ? 'ready' : 'drafting';
        this.publish({ draftStatus, phase: 'editing' });
        await this.handle.updateContext(this.deps.context(draft));
        await this.handle.resolveTool(event.callId, { ok: true, draft, status: draftStatus });
        if (event.name === 'submit_to_agent' && !this.disposed)
            this.deps.inputActions.submit();
    }
    publish(patch) {
        this.state = { ...this.state, ...patch };
        for (const listener of this.listeners)
            listener();
    }
}
export function providerOpenOptions(settings, context) {
    const browser = settings.recognitionProvider === 'browser';
    const openai = settings.recognitionProvider === 'openai-realtime';
    return {
        protocol: browser ? 'browser-recognition' : openai ? 'openai-webrtc' : 'doubao-realtime-duplex',
        routeId: browser ? '' : openai ? settings.openaiRealtimeModel : settings.doubaoRealtimeModel,
        profileId: openai ? `session-assistant-openai-${settings.openaiRealtimeVoice}` : 'session-assistant',
        context,
        language: settings.recognitionLang,
    };
}
