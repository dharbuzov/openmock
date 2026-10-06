import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../register-typescript.mjs";
const { SentenceBuffer } = load("../src/lib/voice/sentence-buffer.ts");
const { SpeechStream, SpeechLatency } = load(
  "../src/lib/voice/speech-stream.ts",
);
const { AudioQueue } = load("../src/lib/voice/audio-queue.ts");
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("cumulative stream flushes sentences immediately without repeating text or token fragments", () => {
  const buffer = new SentenceBuffer();
  assert.deepEqual(buffer.push("Okay, let's"), []);
  const first = "Okay, let's start with your database design.";
  assert.deepEqual(buffer.push(first), [first]);
  assert.deepEqual(buffer.push(first), []);
  const next = first + " First, what storage technology would you choose?";
  assert.deepEqual(buffer.push(next), [
    "First, what storage technology would you choose?",
  ]);
  assert.deepEqual(buffer.push(next, true), []);
  assert.deepEqual(buffer.push(next + " Explain your choice", true), [
    "Explain your choice",
  ]);
});

test("threshold flushes long sentences at word boundaries and retains the final tail", () => {
  const buffer = new SentenceBuffer();
  const text = Array(60).fill("database").join(" ") + ".";
  const chunks = buffer.push(text);
  assert.ok(chunks.length >= 3);
  assert.ok(chunks.every((chunk) => chunk.length <= 160));
  assert.equal([...chunks, ...buffer.push(text, true)].join(" "), text);
  assert.deepEqual(new SentenceBuffer().push("oneVeryLongWord".repeat(20)), []);
});

test("decimals, abbreviations, newlines, and trimmed final whitespace retain meaningful chunks", () => {
  const buffer = new SentenceBuffer();
  assert.deepEqual(buffer.push("Ask Dr. Jones about version 3."), []);
  assert.deepEqual(
    buffer.push("Ask Dr. Jones about version 3.14.\nNext step!"),
    ["Ask Dr. Jones about version 3.14.", "Next step!"],
  );
  assert.deepEqual(
    buffer.push("Ask Dr. Jones about version 3.14.\nNext step!", true),
    [],
  );
  const newline = new SentenceBuffer();
  assert.deepEqual(newline.push("A meaningful line\n"), ["A meaningful line"]);
  assert.deepEqual(newline.push("A meaningful line", true), []);
});

test("TTS starts before stream completion and synthesizes ahead of playback in order", async () => {
  const submitted = [],
    played = [],
    pending = [],
    events = [];
  const provider = {
    synthesize: (text) => {
      submitted.push(text);
      return new Promise((resolve) => pending.push(resolve));
    },
  };
  const stream = new SpeechStream(
    provider,
    "af_heart",
    async (audio) => played.push(await audio.text()),
    assert.fail,
    (event) => events.push(event),
  );
  stream.push("A meaningful first sentence.");
  assert.deepEqual(submitted, ["A meaningful first sentence."]);
  assert.equal(played.length, 0);
  stream.push("A meaningful first sentence. What would you choose?");
  assert.equal(submitted.length, 1, "only one inference is in flight");
  pending.shift()(new Blob(["first"]));
  await flush();
  assert.deepEqual(played, ["first"]);
  assert.deepEqual(submitted, [
    "A meaningful first sentence.",
    "What would you choose?",
  ]);
  pending.shift()(new Blob(["second"]));
  await flush();
  stream.push("A meaningful first sentence. What would you choose?", true);
  assert.deepEqual(played, ["first", "second"]);
  assert.equal(
    submitted.length,
    2,
    "final text does not replay submitted sentences",
  );
  assert.ok(events.includes("TTS first audio received"));
});

test("a failed chunk is skipped without blocking subsequent audio or changing final text", async () => {
  const errors = [],
    played = [];
  const provider = {
    synthesize: async (text) => {
      if (text.startsWith("First")) throw new Error("offline");
      return new Blob([text]);
    },
  };
  const stream = new SpeechStream(
    provider,
    "",
    async (audio) => played.push(await audio.text()),
    (error) => errors.push(error),
    () => {},
  );
  const finalText = "First sentence. Second sentence.";
  stream.push(finalText, true);
  await flush();
  assert.equal(errors.length, 1);
  assert.deepEqual(played, ["Second sentence."]);
  assert.equal(finalText, "First sentence. Second sentence.");
});

test("cancel aborts synthesis and discards late audio and all remaining chunks", async () => {
  let complete, signal;
  const played = [],
    submitted = [];
  const stream = new SpeechStream(
    {
      synthesize: (text, options) => {
        signal = options.signal;
        submitted.push(text);
        return new Promise((resolve) => {
          complete = resolve;
        });
      },
    },
    "",
    async (audio) => played.push(audio),
    assert.fail,
    () => {},
  );
  stream.push("First sentence. Second sentence.", true);
  stream.cancel();
  assert.equal(signal.aborted, true);
  complete(new Blob(["late"]));
  await flush();
  stream.push("Another sentence.", true);
  assert.deepEqual(played, []);
  assert.equal(submitted.length, 1);
});

function context() {
  const sources = [];
  return {
    sources,
    state: "running",
    currentTime: 10,
    destination: {},
    decodeAudioData: async () => ({ duration: 2 }),
    createBufferSource() {
      const node = {
        connect() {},
        disconnect() {},
        start(time) {
          this.startTime = time;
        },
        stop() {
          this.stopped = true;
        },
      };
      sources.push(node);
      return node;
    },
  };
}

test("audio chunks share a continuous timeline with no overlap or avoidable gap", async () => {
  const ctx = context(),
    speaking = [];
  let first = 0;
  const queue = new AudioQueue(
    ctx,
    (value) => speaking.push(value),
    () => first++,
  );
  const signal = new AbortController().signal;
  await queue.enqueue(new Blob(["wav"]), signal);
  await queue.enqueue(new Blob(["wav"]), signal);
  assert.deepEqual(
    ctx.sources.map((source) => source.startTime),
    [10, 12],
  );
  assert.equal(first, 1);
  ctx.sources[0].onended();
  assert.equal(speaking.at(-1), true);
  ctx.sources[1].onended();
  assert.equal(speaking.at(-1), false);
});

test("queue cancellation stops scheduled nodes and rejects late decoder output", async () => {
  const ctx = context(),
    queue = new AudioQueue(
      ctx,
      () => {},
      () => {},
    );
  await queue.enqueue(new Blob(["wav"]), new AbortController().signal);
  let decoded;
  ctx.decodeAudioData = () =>
    new Promise((resolve) => {
      decoded = resolve;
    });
  const pending = queue.enqueue(
    new Blob(["wav"]),
    new AbortController().signal,
  );
  await flush();
  queue.cancel();
  decoded({ duration: 2 });
  await pending;
  assert.equal(ctx.sources.length, 1);
  assert.equal(ctx.sources[0].stopped, true);
});

test("voice timings follow DEBUG level, preserve turn correlation, and log once per milestone", () => {
  const { installLogger } = load("../src/lib/logging/logger.ts");
  const original = process.env.NODE_ENV;
  const events = [];
  installLogger({
    debug: (context) => events.push(context),
    isLevelEnabled: () => true,
  });
  try {
    process.env.NODE_ENV = "development";
    const timing = new SpeechLatency({
      interviewId: "interview",
      turnId: "turn",
      startedAt: performance.now(),
    });
    for (const event of [
      "LLM first token",
      "TTS first chunk submitted",
      "TTS first audio received",
      "First audio playback",
    ]) {
      timing.mark(event);
      timing.mark(event);
    }
    assert.equal(events.length, 4);
    assert.equal(events[0].sinceFirstTokenMs, 0);
    assert.equal(events[0].turnId, "turn");
    assert.equal(events[0].interviewId, "interview");
    assert.ok(
      events.every((event) => !("text" in event) && event.elapsedMs >= 0),
    );
    process.env.NODE_ENV = "production";
    new SpeechLatency().mark("LLM first token");
    assert.equal(events.length, 5);
    installLogger({
      debug: (context) => events.push(context),
      isLevelEnabled: () => false,
    });
    new SpeechLatency().mark("LLM first token");
    assert.equal(events.length, 5);
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
    installLogger(undefined);
  }
});
