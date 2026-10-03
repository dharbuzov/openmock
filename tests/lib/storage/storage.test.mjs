import { test } from "node:test";
import assert from "node:assert/strict";
import { load, storage } from "../../register-typescript.mjs";

const { LocalStorage } = load("../src/lib/storage/local-storage.ts");
const { SettingsStorage, readSettings } = load(
  "../src/lib/settings/storage.ts",
);
const { defaultSettings } = load("../src/lib/settings/types.ts");
const { openAIModels, anthropicModels, defaultSettingsByProvider } = load(
  "../src/lib/settings/types.ts",
);
const { InterviewLayoutStorage, defaultLayout } = load(
  "../src/lib/interview/layout-storage.ts",
);
const { saveEvaluation, readEvaluationValue, parseEvaluation } = load(
  "../src/lib/interview/evaluation-storage.ts",
);

function memory() {
  const entries = new Map();
  return {
    get: (key) => entries.get(key) ?? null,
    set: (key, value) => entries.set(key, value),
    remove: (key) => entries.delete(key),
    getText: (key) => entries.get(key) ?? null,
    setText: (key, value) => entries.set(key, value),
  };
}

test("cloud provider settings retain supported models and fall back for missing or invalid models", () => {
  const preferences = memory();
  const domain = new SettingsStorage(preferences, memory(), memory());
  for (const [provider, models] of [
    ["openai", openAIModels],
    ["anthropic", anthropicModels],
  ]) {
    for (const model of [
      ...models.map(({ value }) => value),
      undefined,
      "unsupported",
    ]) {
      preferences.set("openmock:ai-preferences", {
        provider,
        [provider]: { model },
      });
      assert.equal(
        domain.readSettings().model,
        models.some(({ value }) => value === model)
          ? model
          : defaultSettingsByProvider[provider].model,
      );
    }
  }
});

test("browser adapter preserves JSON, text, scopes, missing values and removal", () => {
  globalThis.window = { localStorage: storage(), sessionStorage: storage() };
  try {
    const local = new LocalStorage();
    const session = new LocalStorage("sessionStorage");
    const text = new LocalStorage("localStorage");
    assert.equal(local.get("missing"), null);
    local.set("value", { nested: [1, true] });
    assert.equal(window.localStorage.getItem("value"), '{"nested":[1,true]}');
    assert.deepEqual(local.get("value"), { nested: [1, true] });
    assert.equal(session.get("value"), null);
    session.set("session", "value");
    assert.equal(window.sessionStorage.getItem("session"), '"value"');
    text.setText("key", 'secret"value');
    assert.equal(text.getText("key"), 'secret"value');
    assert.equal(window.localStorage.getItem("key"), 'secret"value');
    local.remove("value");
    assert.equal(local.get("value"), null);
    window.localStorage.setItem("broken", "{");
    assert.throws(() => local.get("broken"), SyntaxError);
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("blocked");
      },
    });
    assert.throws(() => local.get("value"), /blocked/);
    assert.deepEqual(readSettings(), defaultSettings);
  } finally {
    delete globalThis.window;
  }
});

test("adapter and settings reads tolerate SSR without browser storage", () => {
  const adapter = new LocalStorage();
  assert.equal(adapter.get("missing"), null);
  adapter.set("value", {});
  adapter.remove("value");
  assert.deepEqual(readSettings(), defaultSettings);
});

test("settings preserve provider preferences, keys and key lifetime", () => {
  for (const rememberApiKey of [true, false]) {
    const preferences = memory(),
      persistent = memory(),
      temporary = memory();
    const domain = new SettingsStorage(preferences, persistent, temporary);
    assert.deepEqual(domain.readSettings(), defaultSettings);
    preferences.set("openmock:ai-preferences", {
      provider: "openai",
      openai: {
        model: "gpt-4.1",
        rememberApiKey,
      },
    });
    const keys = rememberApiKey ? persistent : temporary;
    keys.setText("openmock:api-key:openai", "openai-secret");
    assert.equal(domain.readSettings().apiKey, "openai-secret");
    assert.equal(domain.readSettings().model, "gpt-4.1");
    domain.saveSettings({
      provider: "ollama",
      interviewerVoiceEnabled: true,
      baseUrl: " http://localhost:11434 ",
      model: "local",
    });
    assert.equal(keys.get("openmock:api-key:openai"), "openai-secret");
    assert.deepEqual(preferences.get("openmock:ai-preferences"), {
      provider: "ollama",
      interviewerVoiceEnabled: true,
      openai: { model: "gpt-4.1", rememberApiKey },
      ollama: { baseUrl: "http://localhost:11434", model: "local" },
    });
    domain.saveSettings({
      ...defaultSettingsByProvider.anthropic,
      apiKey: "anthropic-secret",
      rememberApiKey,
    });
    assert.equal(domain.readSettings().apiKey, "anthropic-secret");
    assert.equal(domain.readProviderSettings("openai").apiKey, "openai-secret");
    assert.equal(domain.readProviderSettings("ollama").model, "local");
    domain.saveSettings({
      ...defaultSettingsByProvider.openai,
      apiKey: "new-secret",
      rememberApiKey,
    });
    assert.equal(keys.get("openmock:api-key:openai"), "new-secret");
    domain.saveSettings({
      ...defaultSettingsByProvider.openai,
      apiKey: "temporary",
      rememberApiKey: false,
    });
    assert.equal(persistent.get("openmock:api-key:openai"), null);
    assert.equal(temporary.get("openmock:api-key:openai"), "temporary");
    domain.saveSettings({ ...defaultSettingsByProvider.openai, apiKey: "" });
    assert.equal(temporary.get("openmock:api-key:openai"), null);
    preferences.set("openmock:ai-preferences", {
      provider: "unknown",
      openai: { model: "unknown" },
    });
    assert.deepEqual(domain.readSettings(), defaultSettings);
  }
});

test("interviewer voice defaults safely and survives storage recreation for every provider", () => {
  const preferences = memory();
  const domain = new SettingsStorage(preferences, memory(), memory());
  for (const value of [undefined, null, "false", 0]) {
    preferences.set("openmock:ai-preferences", {
      interviewerVoiceEnabled: value,
    });
    assert.equal(domain.readSettings().interviewerVoiceEnabled, true);
  }
  for (const interviewerVoiceEnabled of [false, true]) {
    domain.saveSettings({ ...defaultSettings, interviewerVoiceEnabled });
    const restarted = new SettingsStorage(preferences, memory(), memory());
    assert.equal(
      restarted.readSettings().interviewerVoiceEnabled,
      interviewerVoiceEnabled,
    );
    for (const provider of ["openai", "anthropic", "ollama"]) {
      assert.equal(
        restarted.readProviderSettings(provider).interviewerVoiceEnabled,
        interviewerVoiceEnabled,
      );
    }
  }
});

test("settings reads and saves never access old storage keys", () => {
  const preferences = memory(),
    persistent = memory(),
    temporary = memory();
  for (const backing of [preferences, persistent, temporary]) {
    for (const key of [
      "openmock:ai-preferences:v1",
      "openmock:ai-preferences:v2",
      "openmock:api-key:v1",
      "openmock:api-key:v2:openai",
      "openmock:api-key:v2:anthropic",
    ]) {
      backing.set(key, "old-value");
    }
    for (const method of ["get", "getText", "set", "setText", "remove"]) {
      const operation = backing[method];
      backing[method] = (key, ...args) => {
        assert.ok(!/:v[12]/.test(key), `Unexpected old key access: ${key}`);
        return operation(key, ...args);
      };
    }
  }
  const domain = new SettingsStorage(preferences, persistent, temporary);
  assert.deepEqual(domain.readSettings(), defaultSettings);
  for (const provider of ["openai", "anthropic", "ollama"]) {
    assert.deepEqual(
      domain.readProviderSettings(provider),
      defaultSettingsByProvider[provider],
    );
    domain.saveSettings(defaultSettingsByProvider[provider]);
  }
});

test("current settings JSON and raw keys remain readable and writable", () => {
  globalThis.window = { localStorage: storage(), sessionStorage: storage() };
  try {
    window.localStorage.setItem(
      "openmock:ai-preferences",
      '{"provider":"openai","openai":{"model":"gpt-4.1","rememberApiKey":true}}',
    );
    window.localStorage.setItem("openmock:api-key:openai", "raw-secret");
    const domain = new SettingsStorage(
      new LocalStorage(),
      new LocalStorage("localStorage"),
      new LocalStorage("sessionStorage"),
    );
    assert.equal(domain.readSettings().apiKey, "raw-secret");
    domain.saveSettings(domain.readSettings());
    assert.equal(
      window.localStorage.getItem("openmock:api-key:openai"),
      "raw-secret",
    );
    assert.deepEqual(
      JSON.parse(window.localStorage.getItem("openmock:ai-preferences")),
      {
        provider: "openai",
        interviewerVoiceEnabled: true,
        openai: { model: "gpt-4.1", rememberApiKey: true },
      },
    );
    window.localStorage.setItem("openmock:ai-preferences", "{");
    assert.deepEqual(domain.readSettings(), defaultSettings);
    assert.throws(() => domain.saveSettings(defaultSettings), SyntaxError);
  } finally {
    delete globalThis.window;
  }
});

test("interview layout persistence validates existing values using injected storage", () => {
  const backing = memory();
  const domain = new InterviewLayoutStorage(backing);
  assert.deepEqual(domain.readLayout(), defaultLayout);
  const layout = { problem: 25, workspace: 50, interviewer: 25 };
  domain.saveLayout(layout);
  assert.deepEqual(backing.get("openmock:interview-layout"), layout);
  assert.deepEqual(domain.readLayout(), layout);
  for (const invalid of [
    {},
    { problem: -1, workspace: 79, interviewer: 22 },
    { ...layout, workspace: 1 },
  ]) {
    backing.set("openmock:interview-layout", invalid);
    assert.deepEqual(domain.readLayout(), defaultLayout);
  }
  const blocked = new InterviewLayoutStorage({
    get() {
      throw Error();
    },
    set() {
      throw Error();
    },
    remove() {},
  });
  assert.deepEqual(blocked.readLayout(), defaultLayout);
  assert.doesNotThrow(() => blocked.saveLayout(layout));
});

test("evaluation persistence preserves its key and handles invalid snapshots", () => {
  const backing = memory();
  const value = { interviewId: "existing" };
  saveEvaluation(value, backing);
  assert.deepEqual(backing.get("openmock:interview-result:v3:existing"), value);
  assert.equal(readEvaluationValue("missing", backing), null);
  for (const invalid of [null, "{", "{}"])
    assert.equal(parseEvaluation(invalid), null);
  assert.equal(
    readEvaluationValue("existing", {
      getText() {
        throw Error();
      },
    }),
    null,
  );
});
