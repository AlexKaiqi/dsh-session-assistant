import { Context, Service } from '@deepseek-ai/cordis'
type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue }

interface TaskPipelineResult {
  readonly output: Readonly<Record<string, JsonValue>>
}

interface TaskPipelineRuntimeLike {
  invoke(task: 'transcription' | 'speech-synthesis', input: { routeId: string; operation: string; request: Readonly<Record<string, JsonValue>> }, signal: AbortSignal): Promise<TaskPipelineResult>
}

export interface ComposedAsrRequest {
  readonly routeId: string
  readonly operation: string
  readonly audio: Readonly<Record<string, JsonValue>>
}

export interface ComposedTtsRequest {
  readonly routeId: string
  readonly operation: string
  readonly text: string
  readonly options?: Readonly<Record<string, JsonValue>>
}

/** Host boundary for composed voice stages. Provider adapters own all media and wire details. */
export class ComposedVoicePipelineHost extends Service {
  constructor(ctx: Context) {
    super(ctx, 'composedVoicePipelineHost')
  }

  async transcribe(request: ComposedAsrRequest, signal: AbortSignal): Promise<{ text: string; output: Readonly<Record<string, JsonValue>> }> {
    const runtime = this.runtime()
    const result = await runtime.invoke('transcription', { routeId: request.routeId, operation: request.operation, request: request.audio }, signal)
    const text = typeof result.output.text === 'string' ? result.output.text.trim() : ''
    if (!text) throw new Error(`ASR route '${request.routeId}' returned no final text`)
    return { text, output: result.output }
  }

  async synthesize(request: ComposedTtsRequest, signal: AbortSignal): Promise<{ uri: string; output: Readonly<Record<string, JsonValue>> }> {
    const runtime = this.runtime()
    const result = await runtime.invoke('speech-synthesis', {
      routeId: request.routeId,
      operation: request.operation,
      request: { text: request.text, ...(request.options ?? {}) },
    }, signal)
    const uri = typeof result.output.uri === 'string' ? result.output.uri : typeof result.output.url === 'string' ? result.output.url : ''
    if (!uri) throw new Error(`TTS route '${request.routeId}' returned no durable audio URI`)
    return { uri, output: result.output }
  }

  private runtime(): TaskPipelineRuntimeLike {
    const runtime = this.ctx.get('taskPipelineRuntime') as TaskPipelineRuntimeLike | undefined
    if (runtime === undefined) throw new Error('taskPipelineRuntime is unavailable; install and enable dsh-multi-model-provider')
    return runtime
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    composedVoicePipelineHost: ComposedVoicePipelineHost
  }
}
