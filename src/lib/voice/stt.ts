// Contract only; no speech provider is connected.
export interface SpeechToText {
  transcribe(audio: Blob): Promise<string>;
}
