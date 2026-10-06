import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadComponent,
  hookHarness,
  findElement,
} from "../helpers/components.mjs";

function harness(listModels = async () => ["qwen3:8b"]) {
  const hooks = hookHarness();
  const overrides = {
    react: hooks.react,
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
  return { render, section, connection, dispose: hooks.dispose };
}

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
