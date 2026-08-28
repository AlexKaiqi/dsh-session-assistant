import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { ComposedVoicePipelineHost } from './composed-pipeline-host.ts'

export interface RemoteTranscribeRequest {
  readonly routeId: string
  readonly inputArtifactId: string
}

export interface RemoteSynthesizeRequest {
  readonly routeId: string
  readonly text: string
  readonly speaker?: string
}

export interface RemoteTranscriptionResult { readonly text: string }
export interface RemoteSynthesisResult { readonly uri: string; readonly mediaType: 'audio/mpeg' }

function trustedAudioUri(value: string): boolean {
  return /^\/[a-z0-9/_-]*\/artifacts\/audio\/[0-9a-f-]{36}$/.test(value) && !value.includes('//')
}

/** Narrow cancellable RPC boundary: no credentials, endpoints, base64 media, or arbitrary adapter options. */
export class ComposedVoiceRemote extends TypertRemoteService {
  private readonly pipeline: ComposedVoicePipelineHost

  constructor(ctx: Context, pipeline: ComposedVoicePipelineHost) {
    super(ctx, 'composedVoice')
    this.pipeline = pipeline
  }

  @Remote('transcribe')
  async transcribe(request: RemoteTranscribeRequest, signal: AbortSignal): Promise<RemoteTranscriptionResult> {
    const result = await this.pipeline.transcribe({
      routeId: request.routeId,
      operation: 'transcribe-file',
      audio: { inputArtifactId: request.inputArtifactId },
    }, signal)
    return { text: result.text }
  }

  @Remote('synthesize')
  async synthesize(request: RemoteSynthesizeRequest, signal: AbortSignal): Promise<RemoteSynthesisResult> {
    const result = await this.pipeline.synthesize({
      routeId: request.routeId,
      operation: 'synthesize',
      text: request.text,
      ...(request.speaker === undefined ? {} : { options: { speaker: request.speaker } }),
    }, signal)
    if (!trustedAudioUri(result.uri)) throw new Error(`TTS route '${request.routeId}' returned an untrusted audio artifact URI`)
    return { uri: result.uri, mediaType: 'audio/mpeg' }
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    composedVoice: ComposedVoiceRemote
  }
}
