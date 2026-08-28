export interface CapturedPcmAudio {
  readonly pcm16Base64: string
  readonly sampleRate: number
}

export interface AudioArtifactRef {
  readonly uri: string
}
