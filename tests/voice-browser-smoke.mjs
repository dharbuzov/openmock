// Optional real-browser/real-Kokoro smoke check. Requires Playwright and Chrome,
// OpenMock at localhost:3000, and Speech at localhost:8001. No LLM credentials:
// a timed cumulative message stream exercises the production speech modules.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || "playwright");
const modules = Object.fromEntries(
  ["sentence-buffer", "speech-stream", "audio-queue", "local-speech"].map(
    (name) => [
      name,
      ts.transpileModule(readFileSync(`src/lib/voice/${name}.ts`, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
    ],
  ),
);
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--mute-audio"],
});
try {
  const page = await browser.newPage();
  await page.goto("http://localhost:3000");
  await page.evaluate((modules) => {
    window.voiceEvents = [];
    window.process = { env: { NODE_ENV: "development" } };
    const loaded = {};
    const load = (name) => {
      if (name.includes("logging/logger"))
        return {
          logger: { debug: (context) => window.voiceEvents.push(context) },
        };
      const key = name.replace(/^\.\//, "");
      if (loaded[key]) return loaded[key].exports;
      const compiled = (loaded[key] = { exports: {} });
      new Function("require", "module", "exports", modules[key])(
        load,
        compiled,
        compiled.exports,
      );
      return compiled.exports;
    };
    const { SpeechStream, SpeechLatency } = load("speech-stream");
    const { LocalKokoro } = load("local-speech");
    const { AudioQueue } = load("audio-queue");
    const button = document.createElement("button");
    button.textContent = "Run voice smoke check";
    button.onclick = async () => {
      const timing = new SpeechLatency();
      const context = new AudioContext();
      await context.resume();
      const queue = new AudioQueue(
        context,
        () => {},
        () => timing.mark("First audio playback"),
      );
      window.voiceErrors = [];
      window.decodeMs = [];
      const stream = new SpeechStream(
        new LocalKokoro("http://localhost:8001"),
        "af_heart",
        async (audio, signal) => {
          const start = performance.now();
          await queue.enqueue(audio, signal);
          window.decodeMs.push(Math.round(performance.now() - start));
        },
        (error) => window.voiceErrors.push(error.message),
        (event) => timing.mark(event),
      );
      const first = "Okay, let's start with your database design.";
      const final = first + " First, what storage technology would you choose?";
      stream.push("Okay, let's");
      setTimeout(() => stream.push(first), 240);
      setTimeout(() => stream.push(final), 2200);
      setTimeout(() => {
        stream.push(final, true);
        window.llmCompletionMs = Math.round(
          performance.now() - window.voiceStart,
        );
        window.voiceDone = true;
      }, 4000);
      window.voiceStart = performance.now();
      window.stopSmoke = () => {
        stream.cancel();
        queue.cancel();
        void context.close();
      };
    };
    document.body.append(button);
  }, modules);
  await page.getByRole("button", { name: "Run voice smoke check" }).click();
  await page.waitForFunction(
    () => window.voiceDone && window.decodeMs.length >= 2,
    null,
    { timeout: 180_000 },
  );
  const result = await page.evaluate(() => ({
    events: window.voiceEvents,
    decodeMs: window.decodeMs,
    errors: window.voiceErrors,
    llmCompletionMs: window.llmCompletionMs,
  }));
  console.log(JSON.stringify(result, null, 2));
  assert.deepEqual(result.errors, []);
  const playback = result.events.find(
    (event) => event.event === "First audio playback",
  );
  assert.ok(
    playback && playback.elapsedMs < result.llmCompletionMs,
    "audio must start while LLM text is still streaming",
  );
  assert.equal(result.decodeMs.length, 2);
  await page.evaluate(() => window.stopSmoke());
} finally {
  await browser.close();
}
