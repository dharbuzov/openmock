import type { TextToSpeech } from "./tts";
import { SentenceBuffer } from "./sentence-buffer";
import { logger } from "../logging/logger";
import type { TurnContext } from "../logging/turn";

export type SpeechTimingEvent =
  | "LLM first token"
  | "TTS first chunk submitted"
  | "TTS first audio received"
  | "First audio playback";

export class SpeechLatency {
  private readonly started = performance.now();
  private readonly seen = new Set<SpeechTimingEvent>();
  private firstToken?: number;
  constructor(private readonly context?: TurnContext) {}

  mark(event: SpeechTimingEvent): void {
    if (this.seen.has(event)) return;
    this.seen.add(event);
    const now = performance.now();
    if (event === "LLM first token") this.firstToken = now;
    if (logger.isLevelEnabled("debug")) {
      logger.debug(
        {
          ...this.context,
          event,
          elapsedMs: Math.round(now - this.started),
          sinceFirstTokenMs:
            this.firstToken === undefined
              ? undefined
              : Math.round(now - this.firstToken),
        },
        "Voice latency",
      );
    }
  }
}

export class SpeechStream {
  private readonly buffer = new SentenceBuffer();
  private readonly controller = new AbortController();
  private readonly pending: string[] = [];
  private processing = false;
  private final = false;
  private completed = false;

  constructor(
    private readonly provider: TextToSpeech,
    private readonly voice: string,
    private readonly enqueue: (
      audio: Blob,
      signal: AbortSignal,
    ) => Promise<void>,
    private readonly onError: (error: unknown) => void,
    private readonly timing: (event: SpeechTimingEvent) => void,
    private readonly onComplete?: () => void,
  ) {}

  get isPending(): boolean {
    return this.processing || this.pending.length > 0;
  }

  push(snapshot: string, final = false): void {
    if (this.controller.signal.aborted) return;
    this.final ||= final;
    try {
      if (snapshot) this.timing("LLM first token");
      this.pending.push(...this.buffer.push(snapshot, final));
      void this.drain();
    } catch (error) {
      // Speculative speech cannot follow revisions to text already queued.
      this.cancel();
      this.onError(error);
    }
  }

  private async drain(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.pending.length && !this.controller.signal.aborted) {
        const text = this.pending.shift()!;
        try {
          this.timing("TTS first chunk submitted");
          const audio = await this.provider.synthesize(text, {
            voice: this.voice,
            signal: this.controller.signal,
          });
          if (this.controller.signal.aborted) return;
          this.timing("TTS first audio received");
          await this.enqueue(audio, this.controller.signal);
        } catch (error) {
          if (!this.controller.signal.aborted) this.onError(error);
          // A failed chunk is skipped. Remaining text/audio keeps its order.
        }
      }
    } finally {
      this.processing = false;
      if (this.final && !this.completed && !this.controller.signal.aborted) {
        this.completed = true;
        this.onComplete?.();
      }
    }
  }

  cancel(): void {
    this.controller.abort();
    this.pending.length = 0;
  }
}
