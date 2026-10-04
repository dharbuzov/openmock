export interface TranscriptionResult {
  text: string;
  language: string;
}

export interface SpeechToText {
  transcribe(audio: Blob, signal?: AbortSignal): Promise<TranscriptionResult>;
}
