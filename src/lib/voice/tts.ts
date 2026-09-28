// Contract only; no speech provider is connected.
export interface TextToSpeech {
  synthesize(text: string): Promise<Blob>;
}
