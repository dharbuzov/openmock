import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadComponent,
  hookHarness,
  findElement,
} from "../helpers/components.mjs";

function harness(listModels = async () => ["qwen3:8b"]) {
  const hooks = hookHarness();
  const logs = [];
  const overrides = {
    react: hooks.react,
    "@/lib/logging/logger": {
      logger: {
        isLevelEnabled: () => false,
        ...Object.fromEntries(
          ["trace", "debug", "info", "warn", "error"].map((level) => [
            level,
            (context, event) => logs.push({ level, context, event }),
          ]),
        ),
      },
    },
    "next-themes": { useTheme: () => ({ theme: "light", setTheme() {} }) },
    "@/lib/settings/storage": {
      readSpeechSettings: () => ({
        baseUrl: "http://localhost:8001",
        voice: "",
      }),
      readProviderSettings: () => ({
        provider: "ollama",
        baseUrl: "http://localhost:11434",
        model: "qwen3:8b",
      }),
    },
    "@/lib/ai/ollama": { listOllamaModels: listModels },
  };
  for (const [module, names] of Object.entries({
    accordion: [
      "Accordion",
      "AccordionItem",
      "AccordionTrigger",
      "AccordionContent",
    ],
    alert: ["Alert", "AlertTitle", "AlertDescription"],
    spinner: ["Spinner"],
    button: ["Button"],
    dialog: [
      "Dialog",
      "DialogContent",
      "DialogDescription",
      "DialogHeader",
      "DialogTitle",
    ],
    field: [
      "Field",
      "FieldGroup",
      "FieldLabel",
      "FieldSet",
      "FieldLegend",
      "FieldDescription",
    ],
    input: ["Input"],
    switch: ["Switch"],
    select: [
      "Select",
      "SelectContent",
      "SelectGroup",
      "SelectItem",
      "SelectTrigger",
      "SelectValue",
    ],
    separator: ["Separator"],
  }))
    overrides[`@/components/ui/${module}`] = Object.fromEntries(
      names.map((name) => [name, name]),
    );
  const { AISettingsForm } = loadComponent(
    "src/components/settings-dialog.tsx",
    overrides,
  );
  const props = {
    initialSettings: {
      provider: "ollama",
      baseUrl: "http://localhost:11434",
      model: "qwen3:8b",
      interviewerVoiceEnabled: true,
    },
    onSaved() {},
    appearance: true,
  };
  const render = () => hooks.render(AISettingsForm, props);
  const section = (tree, name) =>
    findElement(
      tree,
      (node) => node.type === "AccordionItem" && node.props.value === name,
    );
  const connection = (tree, name) =>
    findElement(
      section(tree, name),
      (node) => typeof node.props.onTest === "function",
    );
  return { render, section, connection, logs, dispose: hooks.dispose };
}

test("unreachable Speech stays inline and cancelled tests do not log failures", async () => {
  const h = harness();
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    await h.connection(h.render(), "speech").props.onTest();
    const connection = h.connection(h.render(), "speech");
    assert.equal(connection.props.state, "error");
    assert.match(connection.props.error, /Could not reach/);
    assert.equal(h.logs.length, 1);
    assert.equal(h.logs[0].level, "warn");
    assert.equal(h.logs[0].context.err.message, "Failed to fetch");

    globalThis.fetch = (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      });
    const pending = connection.props.onTest();
    findElement(
      h.render(),
      (node) => node.props.id === "settings-speech-url",
    ).props.onChange({ target: { value: "http://localhost:8002" } });
    await pending;
    assert.equal(h.connection(h.render(), "speech").props.state, "idle");
    assert.equal(h.logs.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    h.dispose();
  }
});

test("connection controls and helper state stay inside their section; Save stays outside", () => {
  const h = harness();
  const tree = h.render();
  for (const name of ["speech", "provider"]) {
    const node = h.connection(tree, name);
    assert.equal(node.props.state, "idle");
    const ui = node.type(node.props);
    assert.equal(
      findElement(ui, (item) => item.props.role === "status"),
      null,
    );
    assert.equal(
      findElement(ui, (item) => item.type === "Alert"),
      null,
    );
    const testingUI = node.type({
      ...node.props,
      state: "testing",
      error: "Previous error",
    });
    const testingButton = findElement(
      testingUI,
      (item) => item.type === "Button",
    );
    assert.equal(testingButton.props.children[1], "Testing…");
    assert.equal(testingButton.props.disabled, true);
    assert.ok(findElement(testingUI, (item) => item.type === "Spinner"));
    assert.equal(
      findElement(testingUI, (item) => item.type === "Alert"),
      null,
    );
    assert.equal(
      findElement(testingUI, (item) => item.props.role === "status"),
      null,
    );
    const connectedUI = node.type({ ...node.props, state: "connected" });
    const success = findElement(
      connectedUI,
      (item) => item.props.role === "status",
    );
    assert.equal(success.props.children[1], "Connected");
    assert.match(success.props.className, /text-success/);
    assert.equal(
      findElement(connectedUI, (item) => item.type === "Alert"),
      null,
    );
    const errorUI = node.type({
      ...node.props,
      state: "error",
      error: "Friendly error",
    });
    assert.equal(
      findElement(errorUI, (item) => item.props.role === "status"),
      null,
    );
    assert.ok(findElement(errorUI, (item) => item.type === "Alert"));
    assert.ok(
      findElement(
        ui,
        (item) =>
          item.type === "Button" &&
          item.props.children[1] === "Test connection",
      ),
    );
    assert.equal(
      findElement(
        h.section(tree, name),
        (item) => item.props.children === "Save",
      ),
      null,
    );
  }
  assert.ok(
    findElement(
      tree,
      (node) => node.type === "Button" && node.props.children === "Save",
    ),
  );
  h.dispose();
});

test("Speech testing prevents duplicates, clears errors on success or URL edits, and ignores stale responses", async () => {
  const h = harness();
  const originalFetch = globalThis.fetch;
  let resolve;
  let calls = 0;
  globalThis.fetch = (url) => {
    assert.equal(url, "http://localhost:8001/health");
    calls++;
    return new Promise((done) => {
      resolve = done;
    });
  };
  try {
    let tree = h.render();
    const action = h.connection(tree, "speech").props.onTest;
    const pending = action();
    await action();
    assert.equal(calls, 1);
    tree = h.render();
    let connection = h.connection(tree, "speech");
    assert.equal(connection.props.state, "testing");
    const ui = connection.type(connection.props);
    assert.equal(
      findElement(ui, (node) => node.type === "Button").props.disabled,
      true,
    );
    assert.ok(findElement(ui, (node) => node.type === "Spinner"));
    resolve({ ok: false });
    await pending;
    tree = h.render();
    connection = h.connection(tree, "speech");
    assert.equal(connection.props.state, "error");
    assert.ok(
      findElement(
        connection.type(connection.props),
        (node) => node.type === "Alert",
      ),
    );
    assert.equal(h.connection(tree, "provider").props.state, "idle");

    const retry = connection.props.onTest();
    resolve({
      ok: true,
      json: async () => ({
        stt: { status: "not-loaded" },
        tts: { status: "ready" },
      }),
    });
    await retry;
    tree = h.render();
    assert.equal(h.connection(tree, "speech").props.state, "connected");
    assert.equal(h.connection(tree, "speech").props.error, "");

    const stale = h.connection(tree, "speech").props.onTest();
    findElement(
      tree,
      (node) => node.props.id === "settings-speech-url",
    ).props.onChange({ target: { value: "http://localhost:8002" } });
    resolve({
      ok: true,
      json: async () => ({
        stt: { status: "ready" },
        tts: { status: "ready" },
      }),
    });
    await stale;
    assert.equal(h.connection(h.render(), "speech").props.state, "idle");
  } finally {
    globalThis.fetch = originalFetch;
    h.dispose();
  }
});

test("Speech capability errors and AI failures are independent, and model changes invalidate AI results", async () => {
  let fail = true;
  const h = harness(async () => {
    if (fail) throw new Error("ECONNREFUSED private backend detail");
    return ["qwen3:8b", "other-model"];
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ stt: { status: "error" }, tts: { status: "ready" } }),
  });
  try {
    await h.connection(h.render(), "speech").props.onTest();
    await h.connection(h.render(), "provider").props.onTest();
    let tree = h.render();
    assert.equal(h.connection(tree, "speech").props.state, "error");
    assert.equal(h.connection(tree, "provider").props.state, "error");
    assert.doesNotMatch(
      h.connection(tree, "provider").props.error,
      /ECONNREFUSED|private/,
    );
    fail = false;
    await h.connection(tree, "provider").props.onTest();
    tree = h.render();
    assert.equal(h.connection(tree, "provider").props.state, "connected");
    assert.equal(h.connection(tree, "provider").props.error, "");
    assert.equal(h.connection(tree, "speech").props.state, "error");
    findElement(
      tree,
      (node) => node.type === "Select" && node.props.value === "qwen3:8b",
    ).props.onValueChange("other-model");
    tree = h.render();
    assert.equal(h.connection(tree, "provider").props.state, "idle");
    assert.equal(h.connection(tree, "speech").props.state, "error");
  } finally {
    globalThis.fetch = originalFetch;
    h.dispose();
  }
});

function modelSelect(tree) {
  return findElement(
    tree,
    (node) =>
      node.type === "Select" &&
      node.props.items?.some((item) => item.value === "qwen3:8b"),
  );
}

test("Ollama automatically discovers multiple models, refreshes, and preserves selection", async () => {
  let models = ["first", "qwen3:8b", "third"];
  let calls = 0;
  const h = harness(async () => {
    calls++;
    return models;
  });
  try {
    h.render();
    await new Promise((resolve) => setTimeout(resolve, 350));
    let tree = h.render();
    assert.equal(calls, 1);
    assert.deepEqual(
      modelSelect(tree).props.items.map((item) => item.value),
      models,
    );
    assert.equal(modelSelect(tree).props.value, "qwen3:8b");
    models = ["fourth", "qwen3:8b"];
    await h.connection(tree, "provider").props.onTest();
    tree = h.render();
    assert.equal(calls, 2);
    assert.deepEqual(
      modelSelect(tree).props.items.map((item) => item.value),
      models,
    );
    assert.equal(modelSelect(tree).props.value, "qwen3:8b");
    models = [];
    await h.connection(tree, "provider").props.onTest();
    tree = h.render();
    const select = findElement(
      tree,
      (node) => node.type === "Select" && node.props.disabled === true,
    );
    assert.deepEqual(select.props.items, []);
    assert.equal(select.props.value, "");
    assert.equal(h.connection(tree, "provider").props.state, "connected");
  } finally {
    h.dispose();
  }
});

test("Ollama URL changes ignore stale discovery and automatically load the new endpoint", async () => {
  let resolve;
  const calls = [];
  const h = harness((settings) => {
    calls.push(settings.baseUrl);
    return new Promise((done) => {
      resolve = done;
    });
  });
  try {
    let tree = h.render();
    const pending = h.connection(tree, "provider").props.onTest();
    await new Promise((done) => setImmediate(done));
    findElement(
      tree,
      (node) => node.props.id === "settings-ollama-url",
    ).props.onChange({ target: { value: "http://localhost:11435" } });
    resolve(["stale"]);
    await pending;
    tree = h.render();
    await new Promise((done) => setTimeout(done, 350));
    resolve(["qwen3:8b", "new"]);
    await new Promise((done) => setImmediate(done));
    tree = h.render();
    assert.deepEqual(calls, [
      "http://localhost:11434",
      "http://localhost:11435",
    ]);
    assert.deepEqual(
      modelSelect(tree).props.items.map((item) => item.value),
      ["qwen3:8b", "new"],
    );
  } finally {
    h.dispose();
  }
});

test(
  "real local Ollama discovery reaches dropdown and preserves selected model on refresh",
  { skip: !process.env.OPENMOCK_TEST_LIVE_OLLAMA },
  async () => {
    const { load } = await import("../register-typescript.mjs");
    const { listOllamaModels } = load("../src/lib/ai/ollama.ts");
    const tags = await (await fetch("http://localhost:11434/api/tags")).json();
    const expected = tags.models
      .filter((model) => model.capabilities.includes("completion"))
      .map((model) => model.name);
    const h = harness(listOllamaModels);
    try {
      h.render();
      await new Promise((done) => setTimeout(done, 350));
      // Wait for the real network request to complete, without substituting transport.
      for (
        let i = 0;
        i < 100 &&
        h.connection(h.render(), "provider").props.state === "testing";
        i++
      )
        await new Promise((done) => setTimeout(done, 100));
      let tree = h.render();
      assert.equal(h.connection(tree, "provider").props.state, "connected");
      assert.deepEqual(
        modelSelect(tree).props.items.map((item) => item.value),
        expected,
      );
      await h.connection(tree, "provider").props.onTest();
      tree = h.render();
      assert.deepEqual(
        modelSelect(tree).props.items.map((item) => item.value),
        expected,
      );
      assert.equal(modelSelect(tree).props.value, "qwen3:8b");
      console.log(
        JSON.stringify({
          endpoint: "http://localhost:11434",
          returned: expected,
          displayed: modelSelect(tree).props.items,
          selected: modelSelect(tree).props.value,
        }),
      );
    } finally {
      h.dispose();
    }
  },
);

test("Ollama refresh chooses an installed replacement and keeps the last list on failure", async () => {
  let fail = false;
  const h = harness(async () => {
    if (fail) throw new Error("offline");
    return ["replacement", "another"];
  });
  try {
    await h.connection(h.render(), "provider").props.onTest();
    let tree = h.render();
    const select = findElement(
      tree,
      (node) => node.type === "Select" && node.props.value === "replacement",
    );
    assert.ok(select);
    fail = true;
    await h.connection(tree, "provider").props.onTest();
    tree = h.render();
    assert.equal(h.connection(tree, "provider").props.state, "error");
    assert.deepEqual(
      findElement(
        tree,
        (node) => node.type === "Select" && node.props.value === "replacement",
      ).props.items,
      select.props.items,
    );
  } finally {
    h.dispose();
  }
});
