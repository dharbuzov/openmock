import { test } from "node:test";
import assert from "node:assert/strict";
import { load, storage } from "../../register-typescript.mjs";

const { LocalStorage } = load("../src/lib/storage/local-storage.ts");
const { SettingsStorage, readSettings } = load("../src/lib/settings/storage.ts");
const { defaultSettings } = load("../src/lib/settings/types.ts");
const { InterviewLayoutStorage, defaultLayout } = load("../src/lib/interview/layout-storage.ts");
const { saveEvaluation, readEvaluationValue, parseEvaluation } = load("../src/lib/interview/evaluation-storage.ts");

function memory() {
  const entries = new Map();
  return { get: (key) => entries.get(key) ?? null, set: (key, value) => entries.set(key, value), remove: (key) => entries.delete(key) };
}

test("browser adapter preserves JSON, text, scopes, missing values and removal", () => {
  globalThis.window = { localStorage: storage(), sessionStorage: storage() };
  try {
    const local = new LocalStorage();
    const session = new LocalStorage("sessionStorage");
    const text = new LocalStorage("localStorage", "text");
    assert.equal(local.get("missing"), null);
    local.set("value", { nested: [1, true] });
    assert.equal(window.localStorage.getItem("value"), '{"nested":[1,true]}');
    assert.deepEqual(local.get("value"), { nested: [1, true] });
    assert.equal(session.get("value"), null);
    session.set("session", "value");
    assert.equal(window.sessionStorage.getItem("session"), '"value"');
    text.set("key", 'secret"value');
    assert.equal(text.get("key"), 'secret"value');
    assert.equal(window.localStorage.getItem("key"), 'secret"value');
    local.remove("value");
    assert.equal(local.get("value"), null);
    window.localStorage.setItem("broken", "{");
    assert.throws(() => local.get("broken"), SyntaxError);
    Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } });
    assert.throws(() => local.get("value"), /blocked/);
    assert.deepEqual(readSettings(), defaultSettings);
  } finally { delete globalThis.window; }
});

test("adapter and settings reads tolerate SSR without browser storage", () => {
  const adapter = new LocalStorage();
  assert.equal(adapter.get("missing"), null);
  adapter.set("value", {});
  adapter.remove("value");
  assert.deepEqual(readSettings(), defaultSettings);
});

test("settings use injected storage and preserve migration, keys and key lifetime", () => {
  for (const rememberApiKey of [true, false]) {
    const preferences = memory(), persistent = memory(), temporary = memory();
    const domain = new SettingsStorage(preferences, persistent, temporary);
    assert.deepEqual(domain.readSettings(), defaultSettings);
    preferences.set("openmock:ai-preferences:v1", { model: "gpt-4.1", rememberApiKey });
    const keys = rememberApiKey ? persistent : temporary;
    keys.set("openmock:api-key:v1", "legacy-secret");
    assert.equal(domain.readSettings().apiKey, "legacy-secret");
    assert.equal(domain.readSettings().model, "gpt-4.1");
    domain.saveSettings({ provider: "ollama", baseUrl: " http://localhost:11434 ", model: "local" });
    assert.equal(keys.get("openmock:api-key:v2:openai"), "legacy-secret");
    assert.equal(keys.get("openmock:api-key:v1"), null);
    assert.deepEqual(preferences.get("openmock:ai-preferences:v2"), {
      provider: "ollama", openai: { model: "gpt-4.1", rememberApiKey },
      ollama: { baseUrl: "http://localhost:11434", model: "local" },
    });
    domain.saveSettings({ ...defaultSettings, apiKey: "new-secret", rememberApiKey });
    assert.equal(keys.get("openmock:api-key:v2:openai"), "new-secret");
    domain.saveSettings({ ...defaultSettings, apiKey: "temporary", rememberApiKey: false });
    assert.equal(persistent.get("openmock:api-key:v2:openai"), null);
    assert.equal(temporary.get("openmock:api-key:v2:openai"), "temporary");
    domain.saveSettings({ ...defaultSettings, apiKey: "" });
    assert.equal(temporary.get("openmock:api-key:v2:openai"), null);
    preferences.set("openmock:ai-preferences:v2", { provider: "unknown", openai: { model: "unknown" } });
    assert.deepEqual(domain.readSettings(), defaultSettings);
  }
});

test("existing settings JSON and raw keys remain readable and writable", () => {
  globalThis.window = { localStorage: storage(), sessionStorage: storage() };
  try {
    window.localStorage.setItem("openmock:ai-preferences:v2", '{"provider":"openai","openai":{"model":"gpt-4.1","rememberApiKey":true}}');
    window.localStorage.setItem("openmock:api-key:v2:openai", "raw-secret");
    const domain = new SettingsStorage(new LocalStorage(), new LocalStorage("localStorage", "text"), new LocalStorage("sessionStorage", "text"));
    assert.equal(domain.readSettings().apiKey, "raw-secret");
    domain.saveSettings(domain.readSettings());
    assert.equal(window.localStorage.getItem("openmock:api-key:v2:openai"), "raw-secret");
    assert.deepEqual(JSON.parse(window.localStorage.getItem("openmock:ai-preferences:v2")), { provider: "openai", openai: { model: "gpt-4.1", rememberApiKey: true } });
    window.localStorage.setItem("openmock:ai-preferences:v2", "{");
    assert.deepEqual(domain.readSettings(), defaultSettings);
    assert.throws(() => domain.saveSettings(defaultSettings), SyntaxError);
  } finally { delete globalThis.window; }
});

test("interview layout persistence validates existing values using injected storage", () => {
  const backing = memory();
  const domain = new InterviewLayoutStorage(backing);
  assert.deepEqual(domain.readLayout(), defaultLayout);
  const layout = { problem: 25, workspace: 50, interviewer: 25 };
  domain.saveLayout(layout);
  assert.deepEqual(backing.get("openmock:interview-layout"), layout);
  assert.deepEqual(domain.readLayout(), layout);
  for (const invalid of [{}, { problem: -1, workspace: 79, interviewer: 22 }, { ...layout, workspace: 1 }]) {
    backing.set("openmock:interview-layout", invalid);
    assert.deepEqual(domain.readLayout(), defaultLayout);
  }
  const blocked = new InterviewLayoutStorage({ get() { throw Error(); }, set() { throw Error(); }, remove() {} });
  assert.deepEqual(blocked.readLayout(), defaultLayout);
  assert.doesNotThrow(() => blocked.saveLayout(layout));
});

test("evaluation persistence preserves its key and handles invalid snapshots", () => {
  const backing = memory();
  const value = { interviewId: "existing" };
  saveEvaluation(value, backing);
  assert.deepEqual(backing.get("openmock:interview-result:v3:existing"), value);
  assert.equal(readEvaluationValue("missing", backing), null);
  for (const invalid of [null, "{", "{}"]) assert.equal(parseEvaluation(invalid), null);
  assert.equal(readEvaluationValue("existing", { get() { throw Error(); } }), null);
});
