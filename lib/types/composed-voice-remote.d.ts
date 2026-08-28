import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { ComposedVoicePipelineHost } from './composed-pipeline-host.ts';
export interface RemoteTranscribeRequest {
    readonly routeId: string;
    readonly inputArtifactId: string;
}
export interface RemoteSynthesizeRequest {
    readonly routeId: string;
    readonly text: string;
    readonly speaker?: string;
}
export interface RemoteTranscriptionResult {
    readonly text: string;
}
export interface RemoteSynthesisResult {
    readonly uri: string;
    readonly mediaType: 'audio/mpeg';
}
/** Narrow cancellable RPC boundary: no credentials, endpoints, base64 media, or arbitrary adapter options. */
export declare class ComposedVoiceRemote extends TypertRemoteService {
    private readonly pipeline;
    constructor(ctx: Context, pipeline: ComposedVoicePipelineHost);
    transcribe(request: RemoteTranscribeRequest, signal: AbortSignal): Promise<RemoteTranscriptionResult>;
    synthesize(request: RemoteSynthesizeRequest, signal: AbortSignal): Promise<RemoteSynthesisResult>;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        composedVoice: ComposedVoiceRemote;
    }
}
//# sourceMappingURL=composed-voice-remote.d.ts.map