var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { SETTINGS_NAMESPACE, normalizeSettings } from "./settings.js";
let SessionAssistantSettingsRemote = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _describe_decorators;
    let _save_decorators;
    let _context_decorators;
    return class SessionAssistantSettingsRemote extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _describe_decorators = [Remote('describe')];
            _save_decorators = [Remote('save')];
            _context_decorators = [Remote('context')];
            __esDecorate(this, null, _describe_decorators, { kind: "method", name: "describe", static: false, private: false, access: { has: obj => "describe" in obj, get: obj => obj.describe }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _save_decorators, { kind: "method", name: "save", static: false, private: false, access: { has: obj => "save" in obj, get: obj => obj.save }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _context_decorators, { kind: "method", name: "context", static: false, private: false, access: { has: obj => "context" in obj, get: obj => obj.context }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        scope = __runInitializers(this, _instanceExtraInitializers);
        constructor(ctx, scope) {
            super(ctx, 'sessionAssistantSettings');
            this.scope = scope;
        }
        async describe() {
            return this.view();
        }
        async save(request) {
            await this.ctx.settings.replace(SETTINGS_NAMESPACE, normalizeSettings(request.settings), request.expectedRevision);
            return this.view();
        }
        async context(request) {
            const knowledge = this.ctx.get('personalKnowledge');
            if (knowledge === undefined)
                return { available: false, text: '', sources: [] };
            const projection = await knowledge.project({
                query: String(request.query || '').slice(0, 2_400),
                sessionId: String(request.sessionId || '').slice(0, 160),
                cwd: String(request.cwd || '').slice(0, 2_000),
                maxChars: Math.max(1_000, Math.min(12_000, Number(request.maxChars) || 6_000)),
            });
            return {
                available: true,
                text: typeof projection.text === 'string' ? projection.text.slice(0, 12_000) : '',
                sources: Array.isArray(projection.sources) ? projection.sources.map(String).slice(0, 40) : [],
            };
        }
        view() {
            const descriptor = this.ctx.settings.describe({ redactSecrets: true }).find(item => item.ns === SETTINGS_NAMESPACE);
            if (descriptor === undefined)
                throw new Error('session-assistant settings namespace is unavailable');
            return { revision: descriptor.revision, writable: this.ctx.settings.writable, settings: structuredClone(this.scope.get()) };
        }
    };
})();
export { SessionAssistantSettingsRemote };
