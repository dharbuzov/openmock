import { test } from "node:test";
import assert from "node:assert/strict";
import { loadComponent } from "../../helpers/components.mjs";

function discovery(fetch) {
  return loadComponent("src/lib/ai/ollama.ts", {
    "../logging/logger": { logger: { info() {}, warn() {} } },
    "./logging": { loggedProviderFetch: () => fetch },
  }).listOllamaModels;
}
const response = (body) => ({ ok: true, status: 200, json: async () => body });

test("Ollama parses all chat models, excludes embeddings, deduplicates and bypasses caching", async () => {
  const list = discovery(async (url, options) => {
    assert.equal(url, "http://localhost:11434/api/tags");
    assert.equal(options.cache, "no-store");
    return response({
      models: [
        { name: "one", capabilities: ["completion"] },
        { name: "two", capabilities: ["completion", "vision"] },
        { name: "embed", capabilities: ["embedding"] },
        { name: "one", capabilities: ["completion"] },
      ],
    });
  });
  assert.deepEqual(await list({ baseUrl: "http://localhost:11434/api/" }), [
    "one",
    "two",
  ]);
});

test("older Ollama model catalogs use show capabilities without model-name heuristics", async () => {
  const list = discovery(async (url, options) => {
    if (url.endsWith("/tags"))
      return response({ models: [{ name: "chat" }, { name: "embed" }] });
    assert.equal(options.method, "POST");
    return response({
      capabilities: [
        JSON.parse(options.body).model === "chat" ? "completion" : "embedding",
      ],
    });
  });
  assert.deepEqual(await list({ baseUrl: "http://localhost:11434" }), ["chat"]);
});

test("empty catalogs succeed; offline, HTTP and malformed responses fail gracefully", async () => {
  assert.deepEqual(
    await discovery(async () => response({ models: [] }))({
      baseUrl: "http://localhost:11434",
    }),
    [],
  );
  for (const fetch of [
    async () => {
      throw new TypeError("offline");
    },
    async () => ({ ok: false }),
    async () => response({ models: {} }),
    async () => response({}),
    async () => response({ models: [null] }),
  ]) {
    await assert.rejects(
      discovery(fetch)({ baseUrl: "http://localhost:11434" }),
      /Cannot connect to Ollama/,
    );
  }
});
