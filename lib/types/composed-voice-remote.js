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
function trustedAudioUri(value) {
    return /^\/[a-z0-9/_-]*\/artifacts\/audio\/[0-9a-f-]{36}$/.test(value) && !value.includes('//');
}
/** Narrow cancellable RPC boundary: no credentials, endpoints, base64 media, or arbitrary adapter options. */
let ComposedVoiceRemote = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _transcribe_decorators;
    let _synthesize_decorators;
    return class ComposedVoiceRemote extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _transcribe_decorators = [Remote('transcribe')];
            _synthesize_decorators = [Remote('synthesize')];
            __esDecorate(this, null, _transcribe_decorators, { kind: "method", name: "transcribe", static: false, private: false, access: { has: obj => "transcribe" in obj, get: obj => obj.transcribe }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _synthesize_decorators, { kind: "method", name: "synthesize", static: false, private: false, access: { has: obj => "synthesize" in obj, get: obj => obj.synthesize }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        pipeline = __runInitializers(this, _instanceExtraInitializers);
        constructor(ctx, pipeline) {
            super(ctx, 'composedVoice');
            this.pipeline = pipeline;
        }
        async transcribe(request, signal) {
            const result = await this.pipeline.transcribe({
                routeId: request.routeId,
                operation: 'transcribe-file',
                audio: { inputArtifactId: request.inputArtifactId },
            }, signal);
            return { text: result.text };
        }
        async synthesize(request, signal) {
            const result = await this.pipeline.synthesize({
                routeId: request.routeId,
                operation: 'synthesize',
                text: request.text,
                ...(request.speaker === undefined ? {} : { options: { speaker: request.speaker } }),
            }, signal);
            if (!trustedAudioUri(result.uri))
                throw new Error(`TTS route '${request.routeId}' returned an untrusted audio artifact URI`);
            return { uri: result.uri, mediaType: 'audio/mpeg' };
        }
    };
})();
export { ComposedVoiceRemote };
