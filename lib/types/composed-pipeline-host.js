import { Service } from '@deepseek-ai/cordis';
/** Host boundary for composed voice stages. Provider adapters own all media and wire details. */
export class ComposedVoicePipelineHost extends Service {
    constructor(ctx) {
        super(ctx, 'composedVoicePipelineHost');
    }
    async transcribe(request, signal) {
        const runtime = this.runtime();
        const result = await runtime.invoke('transcription', { routeId: request.routeId, operation: request.operation, request: request.audio }, signal);
        const text = typeof result.output.text === 'string' ? result.output.text.trim() : '';
        if (!text)
            throw new Error(`ASR route '${request.routeId}' returned no final text`);
        return { text, output: result.output };
    }
    async synthesize(request, signal) {
        const runtime = this.runtime();
        const result = await runtime.invoke('speech-synthesis', {
            routeId: request.routeId,
            operation: request.operation,
            request: { text: request.text, ...(request.options ?? {}) },
        }, signal);
        const uri = typeof result.output.uri === 'string' ? result.output.uri : typeof result.output.url === 'string' ? result.output.url : '';
        if (!uri)
            throw new Error(`TTS route '${request.routeId}' returned no durable audio URI`);
        return { uri, output: result.output };
    }
    runtime() {
        const runtime = this.ctx.get('taskPipelineRuntime');
        if (runtime === undefined)
            throw new Error('taskPipelineRuntime is unavailable; install and enable dsh-multi-model-provider');
        return runtime;
    }
}
