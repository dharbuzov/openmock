import type { SpeechToText, TranscriptionResult } from "./stt";
import type { TextToSpeech } from "./tts";
import { logger } from "../logging/logger";
import type { TurnContext } from "../logging/turn";

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

async function request(
  baseUrl: string,
  path: string,
  init: RequestInit,
  context: Record<string, unknown>,
) {
  const url = speechUrl(baseUrl, path);
  const started = performance.now();
  const timeout = AbortSignal.timeout(180_000);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;
  // A busy response means inference never started, so retrying cannot duplicate it.
  // Keep inference serialized on the service, with a bounded, cancellable client wait.
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        credentials: "omit",
        redirect: "error",
        signal,
      });
    } catch (error) {
      logger.error(
        {
          ...context,
          component: "speech-http",
          endpoint: url,
          method: init.method,
          err: error,
          durationMs: Math.round(performance.now() - started),
        },
        "SPEECH_HTTP_FAILED",
      );
      throw error;
    }
    logger.debug(
      {
        ...context,
        endpoint: url,
        method: init.method,
        status: response.status,
        attempt,
        durationMs: Math.round(performance.now() - started),
        contentType: response.headers.get("content-type"),
        responseBytes: response.headers.get("content-length"),
      },
      "SPEECH_HTTP_RESPONSE",
    );
    if (!response.ok && logger.isLevelEnabled("trace")) {
      try {
        void response
          .clone()
          .text()
          .then((body) =>
            logger.trace(
              { ...context, endpoint: url, status: response.status, body },
              "SPEECH_ERROR_RESPONSE",
            ),
          )
          .catch(() => {});
      } catch {}
    }
    if (response.status !== 429) {
      if (!response.ok) {
        logger.error(
          {
            ...context,
            endpoint: url,
            status: response.status,
            durationMs: Math.round(performance.now() - started),
          },
          "SPEECH_HTTP_FAILED",
        );
        throw new Error("Local speech request failed.");
      }
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
  constructor(
    private readonly baseUrl: string,
    private readonly turnContext?: TurnContext,
  ) {}

  async transcribe(
    audio: Blob,
    signal?: AbortSignal,
  ): Promise<TranscriptionResult> {
    const started = performance.now();
    const context = {
      ...this.turnContext,
      component: "stt",
      operation: "transcribe",
      provider: "whisper",
      endpoint: `${this.baseUrl}/stt/transcribe`,
      requestId: crypto.randomUUID(),
    };
    logger.debug(
      { ...context, audioBytes: audio.size, contentType: audio.type },
      "STT_REQUEST",
    );
    try {
      if (!audio.size) throw new Error("No audio recorded.");
      const body = new FormData();
      body.append("audio", audio, "recording");
      const response = await request(
        this.baseUrl,
        "/stt/transcribe",
        {
          method: "POST",
          body,
          signal,
        },
        context,
      );
      const result: unknown = await response.json();
      if (logger.isLevelEnabled("trace"))
        logger.trace({ ...context, result }, "STT_RESPONSE");
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
      logger.debug(
        {
          ...context,
          durationMs: Math.round(performance.now() - started),
          transcriptLength: result.text.length,
          status: response.status,
        },
        "STT_COMPLETED",
      );
      return { text: result.text.trim(), language: result.language };
    } catch (error) {
      logger.error(
        {
          ...context,
          err: error,
          durationMs: Math.round(performance.now() - started),
        },
        "STT_FAILED",
      );
      throw error;
    }
  }
}

export class LocalKokoro implements TextToSpeech {
  constructor(
    private readonly baseUrl: string,
    private readonly turnContext?: TurnContext,
  ) {}

  async synthesize(
    text: string,
    options?: { voice?: string; signal?: AbortSignal },
  ): Promise<Blob> {
    const started = performance.now();
    const context = {
      ...this.turnContext,
      component: "tts",
      operation: "synthesize",
      provider: "kokoro",
      endpoint: `${this.baseUrl}/tts/synthesize`,
      requestId: crypto.randomUUID(),
      voice: options?.voice || "service-default",
    };
    logger.debug({ ...context, textLength: text.length }, "TTS_STARTED");
    if (logger.isLevelEnabled("trace"))
      logger.trace({ ...context, text }, "TTS_REQUEST");
    try {
      const response = await request(
        this.baseUrl,
        "/tts/synthesize",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            ...(options?.voice ? { voice: options.voice } : {}),
          }),
          signal: options?.signal,
        },
        context,
      );
      if (!response.headers.get("Content-Type")?.startsWith("audio/"))
        throw new Error("Invalid speech audio response.");
      const audio = await response.blob();
      if (!audio.size) throw new Error("Empty speech audio response.");
      const metadata = {
        ...context,
        status: response.status,
        contentType: audio.type,
        audioBytes: audio.size,
        durationMs: Math.round(performance.now() - started),
      };
      logger.trace(metadata, "TTS_RESPONSE");
      logger.debug(metadata, "TTS_COMPLETED");
      return audio;
    } catch (error) {
      logger.error(
        {
          ...context,
          err: error,
          durationMs: Math.round(performance.now() - started),
        },
        "TTS_FAILED",
      );
      throw error;
    }
  }
}
