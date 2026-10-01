import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../register-typescript.mjs";

for (const [label, failure] of [
  ["network error", () => Promise.reject(Error("offline"))],
  [
    "HTTP error",
    () => Promise.resolve(new Response("Unavailable", { status: 503 })),
  ],
  ["empty response", () => Promise.resolve(new Response("   "))],
  [
    "body read error",
    () =>
      Promise.resolve({
        ok: true,
        text: async () => {
          throw Error("interrupted");
        },
      }),
  ],
]) {
  test(`prompt cache retries after ${label} and retains successful loads`, async () => {
    const filename = load.resolve("../src/lib/ai/prompt-loader.ts");
    const cachedModule = load.cache[filename];
    const originalFetch = globalThis.fetch;
    delete load.cache[filename];
    const { loadPrompt } = load(filename);
    let requests = 0;
    globalThis.fetch = () => {
      requests++;
      return requests === 1
        ? failure()
        : Promise.resolve(new Response(" Recovered prompt "));
    };
    try {
      const first = loadPrompt("interviewer");
      assert.equal(loadPrompt("interviewer"), first);
      await assert.rejects(first);
      const retry = loadPrompt("interviewer");
      assert.notEqual(retry, first);
      assert.equal(loadPrompt("interviewer"), retry);
      assert.equal(await retry, "Recovered prompt");
      assert.equal(loadPrompt("interviewer"), retry);
      assert.equal(requests, 2);
    } finally {
      globalThis.fetch = originalFetch;
      delete load.cache[filename];
      if (cachedModule) load.cache[filename] = cachedModule;
    }
  });
}
