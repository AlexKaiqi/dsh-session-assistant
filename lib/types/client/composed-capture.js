/** One browser-captured utterance. Recognition text is only an endpoint signal; provider ASR remains authoritative. */
export function captureComposedUtterance(input) {
    return new Promise((resolve, reject) => {
        let settled = false;
        let handle;
        const finish = (error, audio) => {
            if (settled)
                return;
            settled = true;
            input.signal.removeEventListener('abort', aborted);
            handle?.close();
            if (error !== undefined)
                reject(error);
            else if (audio === undefined)
                reject(new Error('Browser capture returned no audio'));
            else
                resolve(audio);
        };
        const aborted = () => finish(input.signal.reason ?? new DOMException('Aborted', 'AbortError'));
        handle = input.voiceAgent.recognize({
            lang: input.language,
            ownerId: input.ownerId,
            continuous: false,
            interim: true,
            captureAudio: true,
            onTranscript(event) {
                handle.markAudioUtterance?.();
                if (event.final)
                    finish(undefined, handle.takeAudio?.());
            },
            onError(error) { finish(error instanceof Error ? error : new Error(String(error))); },
        });
        input.signal.addEventListener('abort', aborted, { once: true });
        if (input.signal.aborted)
            aborted();
    });
}
export function playAudioUri(uri, signal, createAudio = value => new Audio(value)) {
    return new Promise((resolve, reject) => {
        const audio = createAudio(uri);
        const cleanup = () => { audio.onended = null; audio.onerror = null; signal.removeEventListener('abort', aborted); };
        const aborted = () => { audio.pause(); cleanup(); reject(signal.reason ?? new DOMException('Aborted', 'AbortError')); };
        audio.onended = () => { cleanup(); resolve(); };
        audio.onerror = () => { cleanup(); reject(new Error(`Unable to play synthesized audio URI '${uri}'`)); };
        signal.addEventListener('abort', aborted, { once: true });
        if (signal.aborted)
            return aborted();
        void audio.play().catch(error => { cleanup(); reject(error); });
    });
}
