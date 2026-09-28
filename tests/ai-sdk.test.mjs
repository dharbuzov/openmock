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
const {
  createInitialSystemDesignState,
  mergeSystemDesignState,
  systemDesignOpening,
} = load("../src/lib/interview/system-design.ts");
const {
  captureArchitectureDiagram,
  normalizeExcalidrawScene,
} = load("../src/lib/diagram/normalize-excalidraw.ts");
const { listOllamaModels } = load("../src/lib/ai/ollama.ts");
const {
  EvaluationError,
  evaluateInterviewWithModel,
} = load("../src/lib/ai/evaluation.ts");
const {
  parseEvaluation,
  readEvaluationValue,
  saveEvaluation,
} = load("../src/lib/interview/evaluation-storage.ts");

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

function systemState(overrides = {}) {
  return {
    phase: "clarification",
    coveredTopics: [],
    establishedRequirements: [],
    decisions: [],
    unresolvedQuestions: [],
    challengeAreas: [],
    candidateSignal: "steady",
    ...overrides,
  };
}

function systemTurn(response, state = systemState()) {
  return mockResult(JSON.stringify({ response, state }));
}

function sceneElement(id, type, extra = {}) {
  return {
    id,
    type,
    isDeleted: false,
    boundElements: null,
    x: 999,
    y: 888,
    seed: 12345,
    version: 7,
    strokeColor: "#ff00ff",
    ...extra,
  };
}

const architectureDiagram = {
  nodes: [
    { id: "api", type: "rectangle", label: "API Gateway" },
    { id: "cache", type: "rectangle", label: "Redis" },
  ],
  edges: [{ id: "api-cache", type: "arrow", from: "api", to: "cache", label: "reads" }],
};

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

  assert.equal((await generateInterviewResponseWithModel(model, { problem, messages, code })).content, "What is the complexity?");
  assert.equal(model.doGenerateCalls.length, 1);
  const serializedPrompt = JSON.stringify(model.doGenerateCalls[0].prompt);
  assert.match(serializedPrompt, /Full problem and constraints/);
  assert.match(serializedPrompt, /current buffer/);
  assert.match(serializedPrompt, /constant-time lookup/);
  assert.ok(!serializedPrompt.includes("test-openai"));
});

test("system design interview initializes with clarification and empty internal progress", () => {
  assert.deepEqual(createInitialSystemDesignState(), systemState());
  assert.equal(
    systemDesignOpening({ title: "Design a URL shortening service" }),
    "Let's design a URL shortening service.\n\nBefore we get into the architecture, what requirements would you like to clarify?",
  );
});

test("system design receives centralized instructions and excludes DSA code", async () => {
  const model = new MockLanguageModelV3({ doGenerate: systemTurn("What scale do you expect?") });
  const result = await generateInterviewResponseWithModel(model, {
    problem: { title: "URL Shortener", type: "system-design", content: "Design the service" },
    messages: [{ role: "user", content: "Start with requirements." }],
    code: { language: "TypeScript", content: "must-not-be-sent" },
    systemDesignState: createInitialSystemDesignState(),
  });
  const call = JSON.stringify(model.doGenerateCalls[0]);
  assert.equal(result.content, "What scale do you expect?");
  assert.match(call, /senior\/staff System Design interview/);
  assert.match(call, /candidate's own components and decisions/);
  assert.ok(!call.includes("must-not-be-sent"));
});

test("system design state preserves requirements and decisions while phase can move non-sequentially", () => {
  const previous = systemState({
    establishedRequirements: [{ statement: "Redirects must remain available", evidenceCandidateMessageIndex: 0 }],
    decisions: [{ statement: "Keep analytics off the redirect path", rationale: "Protect latency", evidenceCandidateMessageIndex: 1 }],
  });
  const proposed = systemState({
    phase: "reliability",
    coveredTopics: ["failure modes"],
    challengeAreas: ["analytics queue backpressure"],
  });
  const merged = mergeSystemDesignState(previous, proposed, 2);
  assert.equal(merged.phase, "reliability");
  assert.deepEqual(merged.establishedRequirements, previous.establishedRequirements);
  assert.deepEqual(merged.decisions, previous.decisions);
  assert.deepEqual(merged.challengeAreas, ["analytics queue backpressure"]);
});

test("rectangle with bound text becomes a labeled architecture node", () => {
  const diagram = normalizeExcalidrawScene([
    sceneElement("api", "rectangle", { boundElements: [{ id: "api-label", type: "text" }] }),
    sceneElement("api-label", "text", { text: "API Gateway", containerId: "api" }),
  ]);
  assert.deepEqual(diagram, {
    nodes: [{ id: "api", type: "rectangle", label: "API Gateway" }],
    edges: [],
  });
});

test("multiple architecture components remain separate nodes", () => {
  const diagram = normalizeExcalidrawScene([
    sceneElement("api", "rectangle"),
    sceneElement("cache", "ellipse"),
    sceneElement("decision", "diamond"),
    sceneElement("region", "frame", { name: "EU region" }),
  ]);
  assert.deepEqual(diagram.nodes.map(({ id, type }) => ({ id, type })), [
    { id: "api", type: "rectangle" },
    { id: "cache", type: "ellipse" },
    { id: "decision", type: "diamond" },
    { id: "region", type: "frame" },
  ]);
  assert.equal(diagram.nodes[3].label, "EU region");
});

test("arrow bindings become directed edges with bound labels", () => {
  const diagram = normalizeExcalidrawScene([
    sceneElement("api", "rectangle"),
    sceneElement("db", "rectangle"),
    sceneElement("writes", "arrow", {
      startBinding: { elementId: "api" },
      endBinding: { elementId: "db" },
      boundElements: [{ id: "edge-label", type: "text" }],
    }),
    sceneElement("edge-label", "text", { text: " async writes ", containerId: "writes" }),
  ]);
  assert.deepEqual(diagram.edges, [{
    id: "writes",
    type: "arrow",
    from: "api",
    to: "db",
    label: "async writes",
  }]);
});

test("unbound text creates no fake node or relationship", () => {
  const diagram = normalizeExcalidrawScene([
    sceneElement("note", "text", { text: "API -> database", containerId: null }),
  ]);
  assert.deepEqual(diagram, { nodes: [], edges: [] });
});

test("incomplete arrows normalize safely without inventing endpoints", () => {
  const partial = normalizeExcalidrawScene([
    sceneElement("api", "rectangle"),
    sceneElement("partial", "arrow", { startBinding: { elementId: "api" }, endBinding: null }),
    sceneElement("empty", "line", { startBinding: null, endBinding: null }),
  ]);
  assert.deepEqual(partial.edges, [{ id: "partial", type: "arrow", from: "api" }]);
});

test("deleted elements are ignored and rendering metadata is never normalized", () => {
  const diagram = normalizeExcalidrawScene([
    sceneElement("deleted", "rectangle", { isDeleted: true }),
    sceneElement("api", "rectangle"),
  ]);
  const serialized = JSON.stringify(diagram);
  assert.deepEqual(diagram.nodes, [{ id: "api", type: "rectangle" }]);
  assert.ok(!serialized.includes("strokeColor"));
  assert.ok(!serialized.includes("12345"));
  assert.ok(!serialized.includes("999"));
});

test("scene capture happens on demand and a later capture replaces the current architecture", () => {
  let reads = 0;
  let currentScene = [sceneElement("api", "rectangle")];
  const readScene = () => {
    reads += 1;
    return currentScene;
  };

  currentScene = [...currentScene, sceneElement("db", "rectangle")];
  assert.equal(reads, 0, "drawing changes must not continuously read or send the scene");
  const first = captureArchitectureDiagram(readScene);
  assert.equal(reads, 1);
  assert.deepEqual(first.nodes.map(({ id }) => id), ["api", "db"]);

  currentScene = [...currentScene, sceneElement("cache", "rectangle")];
  assert.equal(reads, 1);
  const updated = captureArchitectureDiagram(readScene);
  assert.equal(reads, 2);
  assert.deepEqual(updated.nodes.map(({ id }) => id), ["api", "db", "cache"]);
  assert.deepEqual(first.nodes.map(({ id }) => id), ["api", "db"]);
});

test("prior candidate decisions remain available to later turns and drive contextual failure attacks", async () => {
  const state = systemState({
    phase: "deep_dive",
    decisions: [{ statement: "Use Kafka for analytics events", rationale: "Decouple redirects", evidenceCandidateMessageIndex: 0 }],
    challengeAreas: ["Kafka partition skew could backpressure producers"],
  });
  const model = new MockLanguageModelV3({
    doGenerate: systemTurn("One Kafka partition receives most traffic. What happens to redirects?", {
      ...state,
      phase: "reliability",
    }),
  });
  const result = await generateInterviewResponseWithModel(model, {
    problem: { title: "URL Shortener", type: "system-design", content: "Design it" },
    messages: [{ role: "user", content: "I would publish analytics events to Kafka." }],
    systemDesignState: state,
  });
  const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
  assert.match(prompt, /Use Kafka for analytics events/);
  assert.match(prompt, /Kafka partition skew/);
  assert.match(result.content, /Kafka partition/);
  assert.equal(result.systemDesignState.phase, "reliability");
});

test("DSA interviews do not receive System Design prompt or state", async () => {
  const model = new MockLanguageModelV3({ doGenerate: mockResult() });
  await generateInterviewResponseWithModel(model, {
    problem: { title: "Two Sum", type: "dsa", content: "Find indices" },
    messages: [{ role: "user", content: "I use a map." }],
    systemDesignState: systemState({ phase: "reliability" }),
  });
  const call = JSON.stringify(model.doGenerateCalls[0]);
  assert.ok(!call.includes("senior/staff System Design interview"));
  assert.ok(!call.includes("systemDesignState"));
});

test("System Design request contains only the latest normalized architecture context", async () => {
  const model = new MockLanguageModelV3({ doGenerate: systemTurn("What happens when Redis is unavailable?") });
  const result = await generateInterviewResponseWithModel(model, {
    problem: { title: "URL Shortener", type: "system-design", content: "Design it" },
    messages: [{ role: "user", content: "I put Redis in front of the database." }],
    systemDesignState: systemState({ phase: "high_level_design" }),
    architectureDiagram,
  });
  const serialized = JSON.stringify(model.doGenerateCalls[0].prompt);
  assert.match(serialized, /currentArchitectureDiagram/);
  assert.match(serialized, /API Gateway/);
  assert.match(serialized, /Redis/);
  assert.ok(!serialized.includes("strokeColor"));
  assert.ok(!serialized.includes("data:image"));
  assert.equal(result.content, "What happens when Redis is unavailable?");
});

test("OpenAI, Anthropic, and Ollama receive identical architecture context", async () => {
  const prompts = [];
  for (const provider of ["openai.responses", "anthropic.messages", "ollama.responses"]) {
    const model = new MockLanguageModelV3({ provider, doGenerate: systemTurn("Why this path?") });
    await generateInterviewResponseWithModel(model, {
      problem: { title: "URL Shortener", type: "system-design", content: "Design it" },
      messages: [{ role: "user", content: "This is the request path." }],
      systemDesignState: systemState({ phase: "high_level_design" }),
      architectureDiagram,
    });
    prompts.push(JSON.stringify(model.doGenerateCalls[0].prompt));
  }
  assert.equal(prompts[0], prompts[1]);
  assert.equal(prompts[1], prompts[2]);
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

test("finish evaluation uses validated structured output and supplied evidence", async () => {
  const structured = {
    interviewType: "dsa",
    overallScore: 99,
    hiringSignal: "yes",
    summary: "The candidate gave a sound approach with clear reasoning.",
    strengths: ["Connected the hash map to lookup complexity."],
    improvements: ["Discuss duplicate-value edge cases explicitly."],
    insufficientEvidence: ["The conversation did not cover testing."],
    categories: {
      problemSolving: { score: 4, summary: "Sound approach.", evidence: [{ source: "candidate-message", sourceIndex: 0, observation: "Candidate proposed a hash map." }] },
      communication: { score: 3, summary: "Mostly clear.", evidence: [{ source: "candidate-message", sourceIndex: 0, observation: "Candidate explained the lookup goal." }] },
      technicalDepth: { score: 4, summary: "Good complexity reasoning.", evidence: [{ source: "code", sourceIndex: 0, observation: "The code creates a Map." }] },
      tradeoffs: { score: 2, summary: "Limited trade-off discussion.", evidence: [{ source: "candidate-message", sourceIndex: 0, observation: "No alternative approach was compared." }] },
    },
  };
  const model = new MockLanguageModelV3({
    provider: "test",
    modelId: "evaluation-model",
    doGenerate: mockResult(JSON.stringify(structured)),
  });
  const code = { language: "TypeScript", content: "const seen = new Map<number, number>();" };
  const evaluation = await evaluateInterviewWithModel(model, {
    problem: { title: "Two Sum", type: "dsa", content: "Return two matching indices." },
    messages: [{ role: "user", content: "I use a hash map for constant-time lookup." }],
    code,
  });

  assert.equal(evaluation.overallScore, 65);
  assert.equal(evaluation.hiringSignal, "yes");
  const call = model.doGenerateCalls[0];
  const prompt = JSON.stringify(call.prompt);
  assert.match(prompt, /constant-time lookup/);
  assert.match(prompt, /new Map/);
  assert.equal(call.responseFormat.type, "json");
  assert.ok(call.responseFormat.schema);
});

test("invalid evaluation output fails safely", async () => {
  const secret = "provider-secret-details";
  const model = new MockLanguageModelV3({ doGenerate: mockResult(JSON.stringify({ error: secret })) });
  await assert.rejects(
    evaluateInterviewWithModel(model, {
      problem: { title: "Two Sum", type: "dsa", content: "Problem" },
      messages: [{ role: "user", content: "Answer" }],
    }),
    (error) => error instanceof EvaluationError && !error.message.includes(secret),
  );
});

test("system design evaluation receives progress and returns grounded qualitative evidence", async () => {
  const state = systemState({
    phase: "wrap_up",
    establishedRequirements: [{ statement: "Redirect p99 below 100 ms", evidenceCandidateMessageIndex: 0 }],
    decisions: [{ statement: "Async analytics queue", rationale: "Protect redirect latency", evidenceCandidateMessageIndex: 1 }],
  });
  const category = (level, summary, observation, sourceIndex = 0) => ({
    level,
    summary,
    evidence: [{ source: "candidate-message", sourceIndex, observation }],
  });
  const structured = {
    interviewType: "system-design",
    hiringSignal: "yes",
    summary: "The candidate separated the critical path and reasoned about failures.",
    strengths: ["Protected redirect latency with asynchronous analytics."],
    improvements: ["Quantify storage growth earlier."],
    insufficientEvidence: ["No detailed retention calculation."],
    keyMoments: [{
      kind: "tradeoff",
      summary: "Moved analytics off the redirect path.",
      evidence: [{ source: "candidate-message", sourceIndex: 1, observation: "Candidate chose an asynchronous queue to protect redirect latency." }],
    }],
    categories: {
      requirementsAndScope: category("strong", "Set a latency target.", "Candidate established a p99 target."),
      architecture: category("strong", "Separated critical and asynchronous paths.", "Candidate proposed API, database, cache, and queue.", 1),
      dataAndState: category("developing", "Named core state but omitted retention.", "Candidate described URL mappings.", 1),
      scalability: category("developing", "Discussed caching without sizing.", "Candidate proposed a read cache.", 1),
      reliability: category("strong", "Isolated analytics failures.", "Candidate moved analytics to an asynchronous queue.", 1),
      tradeoffs: category("strong", "Explained latency versus freshness.", "Candidate accepted eventual analytics consistency.", 1),
      communication: category("strong", "Presented a coherent request path.", "Candidate walked through the redirect flow.", 1),
    },
  };
  const model = new MockLanguageModelV3({ doGenerate: mockResult(JSON.stringify(structured)) });
  const evaluation = await evaluateInterviewWithModel(model, {
    problem: { title: "URL Shortener", type: "system-design", content: "Design it" },
    messages: [
      { role: "user", content: "Redirects should stay below 100 ms p99." },
      { role: "user", content: "I will queue analytics so it cannot slow redirects." },
    ],
    systemDesignState: state,
    architectureDiagram,
  });
  assert.equal(evaluation.interviewType, "system-design");
  assert.equal(evaluation.categories.reliability.level, "strong");
  assert.equal(evaluation.keyMoments[0].evidence[0].sourceIndex, 1);
  const call = model.doGenerateCalls[0];
  assert.match(JSON.stringify(call.prompt), /Async analytics queue/);
  assert.match(JSON.stringify(call.prompt), /API Gateway/);
  assert.equal(call.responseFormat.type, "json");
  assert.ok(!("overallScore" in evaluation));
});

test("serialized evaluation state contains feedback but never provider credentials", () => {
  globalThis.sessionStorage = storage();
  const evaluation = {
    interviewType: "dsa",
    overallScore: 50,
    hiringSignal: "mixed",
    summary: "Limited evidence.",
    strengths: ["Attempted a solution."],
    improvements: ["Explain complexity."],
    insufficientEvidence: ["No edge-case discussion."],
    categories: {
      problemSolving: { score: 3, summary: "Some progress.", evidence: [{ source: "candidate-message", sourceIndex: 0, observation: "Proposed an approach." }] },
      communication: { score: 3, summary: "Understandable.", evidence: [{ source: "candidate-message", sourceIndex: 0, observation: "Explained one step." }] },
      technicalDepth: { score: 2, summary: "Shallow.", evidence: [{ source: "candidate-message", sourceIndex: 0, observation: "No complexity analysis." }] },
      tradeoffs: { score: 2, summary: "Missing.", evidence: [{ source: "candidate-message", sourceIndex: 0, observation: "No alternatives compared." }] },
    },
  };
  saveEvaluation("demo-two-sum", evaluation);
  const serialized = readEvaluationValue("demo-two-sum");
  assert.deepEqual(parseEvaluation(serialized), evaluation);
  assert.ok(!serialized.includes("apiKey"));
  delete globalThis.sessionStorage;
});
