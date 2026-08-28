/**
 * Provider-neutral turn orchestrator. It owns ordering and cancellation only;
 * task adapters own wire protocols, while the Session port owns Agent history.
 */
export class ComposedVoiceTurn {
    controller;
    pipeline;
    ports;
    constructor(pipeline, ports) {
        this.pipeline = pipeline;
        this.ports = ports;
    }
    cancel() {
        this.controller?.abort();
    }
    async run(audio) {
        this.cancel();
        const controller = new AbortController();
        this.controller = controller;
        const phase = (value) => this.ports.onPhase?.(value);
        try {
            phase('transcribing');
            const transcript = (await this.ports.transcribe(audio, this.pipeline.asr, controller.signal)).trim();
            if (!transcript)
                throw new Error('Speech transcription returned no text');
            phase('thinking');
            const reply = await this.ports.submit(transcript, this.pipeline.language, controller.signal);
            const text = this.ports.replyText(reply).trim();
            if (!text)
                throw new Error('Session Agent returned no speakable text');
            phase('synthesizing');
            const output = await this.ports.synthesize(text, this.pipeline.tts, controller.signal);
            phase('playing');
            await this.ports.play(output, controller.signal);
            phase('idle');
            return reply;
        }
        catch (error) {
            phase(controller.signal.aborted ? 'cancelled' : 'failed');
            throw error;
        }
        finally {
            if (this.controller === controller)
                this.controller = undefined;
        }
    }
}
export function composedPipeline(input) {
    return {
        kind: 'composed',
        asr: { routeId: input.asrRouteId, execution: input.asrExecution ?? 'request-response' },
        language: input.language ?? { source: 'current-session' },
        tts: { routeId: input.ttsRouteId, execution: input.ttsExecution ?? 'request-response' },
    };
}
