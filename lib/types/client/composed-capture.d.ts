import type { CapturedPcmAudio } from '../voice-media.ts';
export interface CaptureRecognitionHandle {
    close(): void;
    markAudioUtterance?(): void;
    takeAudio?(): CapturedPcmAudio | undefined;
}
export interface CaptureRecognitionPort {
    recognize(options: {
        lang: string;
        ownerId: string;
        continuous: boolean;
        interim: boolean;
        captureAudio: boolean;
        onTranscript(event: {
            text: string;
            final: boolean;
        }): void;
        onError(error: unknown): void;
    }): CaptureRecognitionHandle;
}
/** One browser-captured utterance. Recognition text is only an endpoint signal; provider ASR remains authoritative. */
export declare function captureComposedUtterance(input: {
    voiceAgent: CaptureRecognitionPort;
    language: string;
    ownerId: string;
    signal: AbortSignal;
}): Promise<CapturedPcmAudio>;
export declare function playAudioUri(uri: string, signal: AbortSignal, createAudio?: (uri: string) => HTMLAudioElement): Promise<void>;
//# sourceMappingURL=composed-capture.d.ts.map