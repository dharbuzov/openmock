export interface TextToSpeech {
  synthesize(
    text: string,
    options?: { voice?: string; signal?: AbortSignal },
  ): Promise<Blob>;
}
