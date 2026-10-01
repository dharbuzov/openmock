import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../register-typescript.mjs";

const { parseConfig } = load("../src/lib/config/schema.ts");
const { config } = load("../src/lib/config/config.ts");
const definitions = load("../src/lib/interview/definitions.ts");
const problems = load("../src/lib/problems/loader.ts");

test("configuration defaults and comma-separated deployment IDs", () => {
  assert.deepEqual(parseConfig({}), {
    ai: { provider: "ollama", model: "qwen3:8b" },
    interviews: { disabled: [] },
  });
  assert.deepEqual(
    parseConfig({
      OPENMOCK_AI_PROVIDER: "openai",
      OPENMOCK_AI_MODEL: " custom-model ",
      OPENMOCK_DISABLED_INTERVIEWS: " custom-interview, ,another-id,, ",
    }),
    {
      ai: { provider: "openai", model: "custom-model" },
      interviews: { disabled: ["custom-interview", "another-id"] },
    },
  );
});

test("invalid configuration identifies the offending environment variable", () => {
  for (const [key, value] of [
    ["OPENMOCK_AI_PROVIDER", "unknown"],
    ["OPENMOCK_AI_MODEL", "   "],
    ["OPENMOCK_DISABLED_INTERVIEWS", "invalid/id"],
  ]) {
    assert.throws(
      () => parseConfig({ [key]: value }),
      new RegExp(`Invalid OpenMock configuration: ${key}`),
    );
  }
});

test("disabled definitions and problems disappear from discovery and direct lookup", async () => {
  const original = config.interviews.disabled;
  const all = await definitions.getInterviewDefinitions({
    includeDisabled: true,
  });
  const catalog = await problems.getProblems();
  const problem = catalog[0];
  try {
    config.interviews.disabled = [problem.interview];
    assert.equal(
      (await definitions.getInterviewDefinitions()).some(
        ({ id }) => id === problem.interview,
      ),
      false,
    );
    assert.equal(
      await definitions.getInterviewDefinition(problem.interview),
      undefined,
    );
    await assert.rejects(
      definitions.requireInterviewDefinition(problem.interview),
      /Unknown interview definition/,
    );
    assert.equal(await problems.getProblem(problem.id), undefined);
    assert.ok(
      (await problems.getProblems()).every(
        (entry) => entry.interview !== problem.interview,
      ),
    );
    config.interviews.disabled = all.map(({ id }) => id);
    assert.deepEqual(await definitions.getInterviewDefinitions(), []);
    assert.deepEqual(await problems.getProblems(), []);
  } finally {
    config.interviews.disabled = original;
  }
});

test("configured cloud defaults reach Settings and saved preferences override them", () => {
  const original = config.ai;
  const paths = [
    "../src/lib/settings/types.ts",
    "../src/lib/settings/storage.ts",
  ].map((path) => load.resolve(path));
  const cached = paths.map((path) => load.cache[path]);
  try {
    config.ai = { provider: "anthropic", model: "deployment-model" };
    for (const path of paths) delete load.cache[path];
    const { SettingsStorage } = load("../src/lib/settings/storage.ts");
    const { anthropicModels } = load("../src/lib/settings/types.ts");
    const entries = new Map();
    const backing = {
      get: (key) => entries.get(key) ?? null,
      set: (key, value) => entries.set(key, value),
      getText: () => null,
    };
    const settings = new SettingsStorage(backing, backing, backing);
    assert.equal(settings.readSettings().provider, "anthropic");
    assert.equal(settings.readSettings().model, "deployment-model");
    assert.ok(
      anthropicModels.some(({ value }) => value === "deployment-model"),
    );
    entries.set("openmock:ai-preferences:v2", {
      provider: "ollama",
      ollama: { model: "user-model", baseUrl: "http://localhost:11434" },
    });
    assert.equal(settings.readSettings().provider, "ollama");
    assert.equal(settings.readSettings().model, "user-model");
    entries.set("openmock:ai-preferences:v1", { model: "gpt-4.1" });
    entries.delete("openmock:ai-preferences:v2");
    assert.equal(settings.readSettings().provider, "openai");
    assert.equal(settings.readSettings().model, "gpt-4.1");
  } finally {
    config.ai = original;
    paths.forEach((path, index) => {
      if (cached[index]) load.cache[path] = cached[index];
      else delete load.cache[path];
    });
  }
});
