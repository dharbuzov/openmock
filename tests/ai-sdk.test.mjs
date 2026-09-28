import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { MockLanguageModelV3 } from "ai/test";

const load = createRequire(import.meta.url);
load.extensions[".ts"] = (module, filename) => {
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  module._compile(outputText, filename);
};

const {
  readProviderSettings,
  readSettings,
  saveSettings,
} = load("../src/lib/settings/storage.ts");
const {
  defaultSettings,
  defaultSettingsByProvider,
} = load("../src/lib/settings/types.ts");
const { getLanguageModel } = load("../src/lib/ai/model.ts");
const {
  AIProviderError,
  generateInterviewResponseWithModel,
} = load("../src/lib/ai/provider.ts");
const { listOllamaModels } = load("../src/lib/ai/ollama.ts");

function storage() {
  const entries = new Map();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
    values: () => [...entries.values()],
  };
}

function mockResult(text = "What is the complexity?") {
  return {
    content: [{ type: "text", text }],
    finishReason: { unified: "stop", raw: "stop" },
    usage: {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    },
  };
}

test("provider settings use the correct AI SDK model and model ID", () => {
  const openai = getLanguageModel({ ...defaultSettingsByProvider.openai, apiKey: "test-openai", model: "gpt-test" });
  const anthropic = getLanguageModel({ ...defaultSettingsByProvider.anthropic, apiKey: "test-anthropic", model: "claude-test" });
  const ollama = getLanguageModel({ ...defaultSettingsByProvider.ollama, baseUrl: "http://127.0.0.1:22444/", model: "local-test" });

  assert.equal(openai.provider, "openai.responses");
  assert.equal(openai.modelId, "gpt-test");
  assert.equal(anthropic.provider, "anthropic.messages");
  assert.equal(anthropic.modelId, "claude-test");
  assert.equal(ollama.provider, "ollama.responses");
  assert.equal(ollama.modelId, "local-test");
  assert.equal(ollama.config.url({ path: "/chat" }), "http://127.0.0.1:22444/api/chat");
});

test("cloud providers reject missing keys while Ollama does not require one", () => {
  assert.throws(() => getLanguageModel(defaultSettingsByProvider.openai), /OpenAI API key/);
  assert.throws(() => getLanguageModel(defaultSettingsByProvider.anthropic), /Anthropic API key/);
  assert.doesNotThrow(() => getLanguageModel({ ...defaultSettingsByProvider.ollama, model: "local-test" }));
});

test("provider switching retains provider-specific preferences and key persistence", () => {
  globalThis.window = { localStorage: storage(), sessionStorage: storage() };
  const openai = { ...defaultSettings, apiKey: "session-openai", model: "gpt-4.1" };
  const anthropic = {
    ...defaultSettingsByProvider.anthropic,
    apiKey: "remembered-anthropic",
    model: "claude-haiku-4-5-20251001",
    rememberApiKey: true,
  };

  saveSettings(openai);
  assert.deepEqual(readSettings(), openai);
  assert.ok(!window.localStorage.values().join("").includes(openai.apiKey));
  saveSettings(anthropic);
  assert.deepEqual(readSettings(), anthropic);
  assert.deepEqual(readProviderSettings("openai"), openai);
  assert.ok(window.localStorage.values().join("").includes(anthropic.apiKey));

  window.sessionStorage = storage();
  assert.equal(readProviderSettings("openai").apiKey, "");
  assert.equal(readProviderSettings("anthropic").apiKey, anthropic.apiKey);
  assert.ok(!window.localStorage.values().some((value) => {
    try {
      return JSON.parse(value).apiKey;
    } catch {
      return false;
    }
  }));
  delete globalThis.window;
});

test("malformed or unavailable storage fails safely", () => {
  globalThis.window = { localStorage: { getItem() { throw new Error("Blocked"); } } };
  assert.deepEqual(readSettings(), defaultSettings);
  delete globalThis.window;
  assert.deepEqual(readSettings(), defaultSettings);
});

test("interview generation passes history and the current DSA code snapshot", async () => {
  const model = new MockLanguageModelV3({
    provider: "test",
    modelId: "selected-model",
    doGenerate: mockResult(),
  });
  const problem = { title: "Two Sum", type: "dsa", content: "Full problem and constraints" };
  const messages = [
    { role: "user", content: "I would use a map." },
    { role: "assistant", content: "Why a map?" },
    { role: "user", content: "For constant-time lookup." },
  ];
  const code = { language: "Python 3", content: "# current buffer\nclass Solution: pass" };

  assert.equal(await generateInterviewResponseWithModel(model, { problem, messages, code }), "What is the complexity?");
  assert.equal(model.doGenerateCalls.length, 1);
  const serializedPrompt = JSON.stringify(model.doGenerateCalls[0].prompt);
  assert.match(serializedPrompt, /Full problem and constraints/);
  assert.match(serializedPrompt, /current buffer/);
  assert.match(serializedPrompt, /constant-time lookup/);
  assert.ok(!serializedPrompt.includes("test-openai"));
});

test("system design context excludes DSA code", async () => {
  const model = new MockLanguageModelV3({ doGenerate: mockResult("What scale do you expect?") });
  await generateInterviewResponseWithModel(model, {
    problem: { title: "URL Shortener", type: "system-design", content: "Design the service" },
    messages: [{ role: "user", content: "Start with requirements." }],
    code: { language: "TypeScript", content: "must-not-be-sent" },
  });
  assert.ok(!JSON.stringify(model.doGenerateCalls[0].prompt).includes("must-not-be-sent"));
});

test("provider failures are converted to safe application errors", async () => {
  const secret = "secret-key-that-must-not-leak";
  const model = new MockLanguageModelV3({
    doGenerate: async () => { throw new Error(secret); },
  });
  await assert.rejects(
    generateInterviewResponseWithModel(model, {
      problem: { title: "Two Sum", type: "dsa", content: "Problem" },
      messages: [{ role: "user", content: "Hello" }],
    }),
    (error) => error instanceof AIProviderError && !error.message.includes(secret),
  );
});

test("Ollama model discovery uses the browser-configured URL and handles failures safely", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  try {
    globalThis.fetch = async (url) => {
      urls.push(String(url));
      return new Response(JSON.stringify({ models: [{ name: "qwen-local:latest" }, { name: "team-model" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    assert.deepEqual(await listOllamaModels({ baseUrl: "http://localhost:22444/" }), ["qwen-local:latest", "team-model"]);
    assert.deepEqual(urls, ["http://localhost:22444/api/tags"]);

    globalThis.fetch = async () => { throw new Error("private stack details"); };
    await assert.rejects(
      listOllamaModels({ baseUrl: "http://localhost:22444" }),
      { message: "Cannot connect to Ollama at http://localhost:22444" },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
