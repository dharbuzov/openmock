import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../register-typescript.mjs";
const { LocalWhisper, LocalKokoro, speechUrl } = load(
  "../src/lib/voice/local-speech.ts",
);

test("Whisper sends multipart audio directly, omits credentials, and validates transcription", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "http://localhost:8001/stt/transcribe");
      assert.equal(init.credentials, "omit");
      assert.equal(init.redirect, "error");
      assert.equal(init.body.get("audio").size, 5);
      return Response.json({ text: "  Use Kafka.  ", language: "en" });
    };
    const whisper = new LocalWhisper("http://localhost:8001/");
    assert.deepEqual(await whisper.transcribe(new Blob(["audio"])), {
      text: "Use Kafka.",
      language: "en",
    });
    globalThis.fetch = async () => Response.json({ text: 123 });
    await assert.rejects(
      whisper.transcribe(new Blob(["audio"])),
      /Invalid transcription/,
    );
    await assert.rejects(whisper.transcribe(new Blob([])), /No audio/);
  } finally {
    globalThis.fetch = original;
  }
});

test("Kokoro returns browser audio and sends only text and independently selected voice", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "http://localhost:8001/tts/synthesize");
      assert.deepEqual(JSON.parse(init.body), {
        text: "Why Kafka?",
        voice: "af_heart",
      });
      return new Response("wav", { headers: { "Content-Type": "audio/wav" } });
    };
    const kokoro = new LocalKokoro("http://localhost:8001");
    assert.equal(
      (await kokoro.synthesize("Why Kafka?", { voice: "af_heart" })).type,
      "audio/wav",
    );
    globalThis.fetch = async () => Response.json({ error: "invalid" });
    await assert.rejects(kokoro.synthesize("Why?"), /Invalid speech audio/);
    globalThis.fetch = async () =>
      new Response(null, { headers: { "Content-Type": "audio/wav" } });
    await assert.rejects(kokoro.synthesize("Why?"), /Empty speech audio/);
  } finally {
    globalThis.fetch = original;
  }
});

test("both adapters fail safely for offline service and non-success HTTP responses", async () => {
  const original = globalThis.fetch;
  const stt = () =>
    new LocalWhisper("http://localhost:8001").transcribe(new Blob(["audio"]));
  const tts = () =>
    new LocalKokoro("http://localhost:8001").synthesize("Hello");
  try {
    for (const mock of [
      async () => {
        throw new Error("offline");
      },
      async () => new Response(null, { status: 503 }),
    ]) {
      globalThis.fetch = mock;
      await assert.rejects(stt());
      await assert.rejects(tts());
    }
    for (const url of [
      "file:///tmp",
      "https://user:pass@localhost",
      "http://localhost/?token=abc",
    ])
      assert.throws(() => speechUrl(url, "/health"));
  } finally {
    globalThis.fetch = original;
  }
});

test("speech preferences persist independently when switching AI providers", () => {
  const { SettingsStorage } = load("../src/lib/settings/storage.ts");
  // Use the existing Storage contract without depending on the DOM.
  const values = new Map();
  const memory = {
    get: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
    getText: () => null,
    setText() {},
    remove() {},
  };
  const settings = new SettingsStorage(memory, memory, memory);
  settings.saveSpeechSettings({
    baseUrl: "http://localhost:9000",
    voice: "am_adam",
  });
  settings.saveSettings({
    ...settings.readProviderSettings("ollama"),
    model: "local",
  });
  settings.saveSettings(settings.readProviderSettings("openai"));
  assert.deepEqual(settings.readSpeechSettings(), {
    baseUrl: "http://localhost:9000",
    voice: "am_adam",
  });
  const unavailable = new SettingsStorage(
    {
      get() {
        throw new Error("storage denied");
      },
    },
    memory,
    memory,
  );
  assert.equal(
    unavailable.readSpeechSettings().baseUrl,
    "http://localhost:8001",
  );
});

test("busy inference retries the same TTS input and honors Retry-After", async (t) => {
  const delays = [];
  t.mock.method(globalThis, "setTimeout", (callback, delay) => {
    delays.push(delay);
    queueMicrotask(callback);
    return 0;
  });
  let calls = 0;
  const bodies = [];
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    bodies.push(init.body);
    return ++calls <= 2
      ? new Response(null, { status: 429, headers: { "Retry-After": "2" } })
      : new Response("wav", { headers: { "Content-Type": "audio/wav" } });
  });
  const result = await new LocalKokoro("http://localhost:8001").synthesize(
    "Why Kafka?",
  );
  assert.equal(result.type, "audio/wav");
  assert.equal(calls, 3);
  assert.deepEqual(delays, [2000, 2000]);
  assert.equal(new Set(bodies).size, 1);
});

test("persistent busy responses have bounded retries and a distinct error", async (t) => {
  t.mock.method(globalThis, "setTimeout", (callback) => {
    queueMicrotask(callback);
    return 0;
  });
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response(null, { status: 429 });
  });
  await assert.rejects(
    new LocalKokoro("http://localhost:8001").synthesize("Hi"),
    /still busy/,
  );
  assert.equal(calls, 13);
});

test("disabling voice during busy retry cancels the wait without another request", async (t) => {
  const controller = new AbortController();
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return new Response(null, { status: 429 });
  });
  t.mock.method(globalThis, "setTimeout", () => {
    queueMicrotask(() => controller.abort());
    return 0;
  });
  await assert.rejects(
    new LocalKokoro("http://localhost:8001").synthesize("Hi", {
      signal: controller.signal,
    }),
    { name: "AbortError" },
  );
  assert.equal(calls, 1);
});
