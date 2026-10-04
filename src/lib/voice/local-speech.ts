import type { SpeechToText, TranscriptionResult } from "./stt";
import type { TextToSpeech } from "./tts";

export interface SpeechSettings {
  baseUrl: string;
  voice: string;
}

export const defaultSpeechSettings: SpeechSettings = {
  baseUrl: "http://localhost:8001",
  voice: "",
};

export function speechUrl(baseUrl: string, path: string): string {
  const url = new URL(baseUrl);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Enter an HTTP(S) local speech URL without credentials, query, or fragment.",
    );
  }
  return `${url.href.replace(/\/$/, "")}${path}`;
}

export class SpeechServiceBusyError extends Error {
  constructor() {
    super("Local Speech is still busy. Wait a moment, then retry.");
  }
}

function waitForRetry(
  milliseconds: number,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}

async function request(baseUrl: string, path: string, init: RequestInit) {
  const url = speechUrl(baseUrl, path);
  const timeout = AbortSignal.timeout(180_000);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;
  // A busy response means inference never started, so retrying cannot duplicate it.
  // Keep inference serialized on the service, with a bounded, cancellable client wait.
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    const response = await fetch(url, {
      ...init,
      credentials: "omit",
      redirect: "error",
      signal,
    });
    if (response.status !== 429) {
      if (!response.ok) throw new Error("Local speech request failed.");
      return response;
    }
    await response.body?.cancel();
    if (attempt === 12) throw new SpeechServiceBusyError();
    const retryAfter = Number(response.headers.get("Retry-After"));
    const seconds = Math.min(
      5,
      Math.max(1, retryAfter || 2 ** Math.min(attempt, 3)),
    );
    await waitForRetry(seconds * 1000, signal);
  }
}

export class LocalWhisper implements SpeechToText {
  constructor(private readonly baseUrl: string) {}

  async transcribe(
    audio: Blob,
    signal?: AbortSignal,
  ): Promise<TranscriptionResult> {
    if (!audio.size) throw new Error("No audio recorded.");
    const body = new FormData();
    body.append("audio", audio, "recording");
    const response = await request(this.baseUrl, "/stt/transcribe", {
      method: "POST",
      body,
      signal,
    });
    const result: unknown = await response.json();
    if (
      !result ||
      typeof result !== "object" ||
      !("text" in result) ||
      typeof result.text !== "string" ||
      !("language" in result) ||
      typeof result.language !== "string"
    ) {
      throw new Error("Invalid transcription response.");
    }
    return { text: result.text.trim(), language: result.language };
  }
}

export class LocalKokoro implements TextToSpeech {
  constructor(private readonly baseUrl: string) {}

  async synthesize(
    text: string,
    options?: { voice?: string; signal?: AbortSignal },
  ): Promise<Blob> {
    const response = await request(this.baseUrl, "/tts/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        ...(options?.voice ? { voice: options.voice } : {}),
      }),
      signal: options?.signal,
    });
    if (!response.headers.get("Content-Type")?.startsWith("audio/"))
      throw new Error("Invalid speech audio response.");
    const audio = await response.blob();
    if (!audio.size) throw new Error("Empty speech audio response.");
    return audio;
  }
}
