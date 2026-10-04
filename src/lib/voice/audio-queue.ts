// One AudioContext clock owns playback. Sources are scheduled consecutively,
// rather than waiting for an HTMLAudioElement's ended event to start each chunk.
export class AudioQueue {
  private sources = new Set<AudioBufferSourceNode>();
  private nextStart = 0;
  private generation = 0;

  constructor(
    private readonly context: AudioContext,
    private readonly onSpeaking: (speaking: boolean) => void,
    private readonly onStarted: () => void,
  ) {}

  async enqueue(audio: Blob, signal: AbortSignal): Promise<void> {
    const generation = this.generation;
    const buffer = await this.context.decodeAudioData(
      await audio.arrayBuffer(),
    );
    if (signal.aborted || generation !== this.generation) return;
    if (this.context.state !== "running")
      throw new Error("Audio playback is blocked.");
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    const start = Math.max(this.context.currentTime, this.nextStart);
    source.onended = () => {
      this.sources.delete(source);
      source.disconnect();
      if (!this.sources.size) this.onSpeaking(false);
    };
    this.sources.add(source);
    source.start(start);
    this.nextStart = start + buffer.duration;
    // The first source starts at currentTime; later sources use the same clock.
    if (this.sources.size === 1) {
      this.onSpeaking(true);
      this.onStarted();
    }
  }

  cancel(): void {
    this.generation++;
    for (const source of this.sources) {
      source.onended = null;
      source.stop();
      source.disconnect();
    }
    this.sources.clear();
    this.nextStart = 0;
    this.onSpeaking(false);
  }
}
