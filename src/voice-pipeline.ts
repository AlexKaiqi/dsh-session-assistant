export type VoicePipelineKind = 'native-realtime' | 'composed'
export type VoiceStageExecution = 'request-response' | 'streaming' | 'realtime'

export interface TaskVoiceStage {
  readonly routeId: string
  readonly execution: VoiceStageExecution
}

export type LanguageStage =
  | { readonly source: 'current-session' }
  | { readonly source: 'fixed'; readonly provider: string; readonly model: string }

export interface NativeRealtimeVoicePipeline {
  readonly kind: 'native-realtime'
  readonly routeId: string
}

export interface ComposedVoicePipeline {
  readonly kind: 'composed'
  readonly asr: TaskVoiceStage
  readonly language: LanguageStage
  readonly tts: TaskVoiceStage
}

export type VoicePipeline = NativeRealtimeVoicePipeline | ComposedVoicePipeline

export type ComposedVoicePhase = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'synthesizing' | 'playing' | 'cancelled' | 'failed'

export interface ComposedVoiceTurnPorts<InputAudio, OutputAudio, Reply> {
  transcribe(audio: InputAudio, stage: TaskVoiceStage, signal: AbortSignal): Promise<string>
  submit(text: string, stage: LanguageStage, signal: AbortSignal): Promise<Reply>
  replyText(reply: Reply): string
  synthesize(text: string, stage: TaskVoiceStage, signal: AbortSignal): Promise<OutputAudio>
  play(audio: OutputAudio, signal: AbortSignal): Promise<void>
  onPhase?(phase: ComposedVoicePhase): void
}

/**
 * Provider-neutral turn orchestrator. It owns ordering and cancellation only;
 * task adapters own wire protocols, while the Session port owns Agent history.
 */
export class ComposedVoiceTurn<InputAudio, OutputAudio, Reply> {
  private controller: AbortController | undefined
  private readonly pipeline: ComposedVoicePipeline
  private readonly ports: ComposedVoiceTurnPorts<InputAudio, OutputAudio, Reply>

  constructor(pipeline: ComposedVoicePipeline, ports: ComposedVoiceTurnPorts<InputAudio, OutputAudio, Reply>) {
    this.pipeline = pipeline
    this.ports = ports
  }

  cancel(): void {
    this.controller?.abort()
  }

  async run(audio: InputAudio): Promise<Reply> {
    this.cancel()
    const controller = new AbortController()
    this.controller = controller
    const phase = (value: ComposedVoicePhase) => this.ports.onPhase?.(value)
    try {
      phase('transcribing')
      const transcript = (await this.ports.transcribe(audio, this.pipeline.asr, controller.signal)).trim()
      if (!transcript) throw new Error('Speech transcription returned no text')
      phase('thinking')
      const reply = await this.ports.submit(transcript, this.pipeline.language, controller.signal)
      const text = this.ports.replyText(reply).trim()
      if (!text) throw new Error('Session Agent returned no speakable text')
      phase('synthesizing')
      const output = await this.ports.synthesize(text, this.pipeline.tts, controller.signal)
      phase('playing')
      await this.ports.play(output, controller.signal)
      phase('idle')
      return reply
    } catch (error) {
      phase(controller.signal.aborted ? 'cancelled' : 'failed')
      throw error
    } finally {
      if (this.controller === controller) this.controller = undefined
    }
  }
}

export function composedPipeline(input: {
  asrRouteId: string
  ttsRouteId: string
  asrExecution?: VoiceStageExecution
  ttsExecution?: VoiceStageExecution
  language?: LanguageStage
}): ComposedVoicePipeline {
  return {
    kind: 'composed',
    asr: { routeId: input.asrRouteId, execution: input.asrExecution ?? 'request-response' },
    language: input.language ?? { source: 'current-session' },
    tts: { routeId: input.ttsRouteId, execution: input.ttsExecution ?? 'request-response' },
  }
}
