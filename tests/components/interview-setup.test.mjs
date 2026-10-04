import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load, storage } from "../register-typescript.mjs";
import { loadDefinition } from "../content-fixtures.mjs";
import {
  loadComponent,
  hookHarness,
  findElement,
} from "../helpers/components.mjs";

const { parseProblemDocument } = load("../src/lib/problems/schema.ts");
const { saveSettings, readSettings, subscribeSettings } = load(
  "../src/lib/settings/storage.ts",
);
const { readInterviewSession } = load(
  "../src/lib/interview/session-storage.ts",
);
const { aiSettingsIssue } = load("../src/lib/settings/types.ts");
const problem = parseProblemDocument(
  readFileSync("content/problems/system-design/url-shortener.md", "utf8"),
);
const definition = loadDefinition("system-design");
const primitives = {
  "next/link": { __esModule: true, default: "a" },
  "@/components/ui/button": { Button: "button", buttonVariants: () => "" },
  "@/components/ui/badge": {
    Badge: ({ variant, ...props }) =>
      React.createElement("span", { ...props, "data-variant": variant }),
  },
  "@/components/ui/field": Object.fromEntries(
    [
      "Field",
      "FieldGroup",
      "FieldDescription",
      "FieldContent",
      "FieldLabel",
      "FieldSet",
      "FieldLegend",
    ].map((name) => [
      name,
      ({ children }) => React.createElement("div", null, children),
    ]),
  ),
  "@/components/ui/tooltip": {
    TooltipProvider: ({ children }) =>
      React.createElement("div", null, children),
    Tooltip: ({ children }) => React.createElement("div", null, children),
    TooltipTrigger: ({ render, children }) =>
      React.cloneElement(render, {}, children),
    TooltipContent: ({ children }) =>
      React.createElement("div", null, children),
  },
  "@/components/ui/separator": { Separator: "hr" },
  "@/components/ui/toggle-group": {
    ToggleGroup: "toggle-group",
    ToggleGroupItem: "toggle-item",
  },
  "./settings-dialog": { AISettingsForm: "settings-form" },
};
function setupHarness(selectedDefinition = definition) {
  const hooks = hookHarness(),
    urls = [];
  let settingsOpened = 0;
  const overrides = {
    ...primitives,
    react: hooks.react,
    "./settings-provider": { useOpenSettings: () => () => settingsOpened++ },
    "next/navigation": { useRouter: () => ({ push: (url) => urls.push(url) }) },
  };
  const { InterviewSetup } = loadComponent(
    "src/components/interview-setup.tsx",
    overrides,
  );
  const form = hooks.render(InterviewSetup, {
    problem,
    definition: selectedDefinition,
  });
  return {
    urls,
    settingsOpened: () => settingsOpened,
    render: () => hooks.render(form.type, form.props),
  };
}
function button(tree) {
  return findElement(
    tree,
    (node) =>
      node.type === "button" && node.props.children === "Start interview",
  );
}

function browser(callback) {
  const original = globalThis.window;
  const events = new EventTarget();
  globalThis.window = {
    localStorage: storage(),
    sessionStorage: storage(),
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  try {
    return callback();
  } finally {
    globalThis.window = original;
  }
}

test("Practice links to Setup and rendering Setup never creates a session", async () => {
  const { default: Practice } = loadComponent("src/app/practice/page.tsx", {
    ...primitives,
    "@/lib/problems/loader": { getProblems: async () => [problem] },
    "@/lib/interview/definitions": {
      getInterviewDefinitions: async () => [definition],
    },
  });
  const html = renderToStaticMarkup(await Practice());
  assert.match(html, /href="\/practice\/url-shortener\/setup"/);
  assert.match(html, /lucide-chevron-right/);
  assert.match(html, /Choose a problem to practice/);
  browser(() => {
    const harness = setupHarness();
    harness.render();
    assert.equal(window.sessionStorage.values().length, 0);
    assert.deepEqual(harness.urls, []);
  });
});

test("Setup uses existing AI configuration, safe summary, company semantics and definition summary", () =>
  browser(() => {
    saveSettings({
      provider: "openai",
      model: "gpt-4.1",
      apiKey: "test-secret",
      rememberApiKey: false,
    });
    const harness = setupHarness(),
      tree = harness.render();
    assert.equal(
      findElement(tree, (node) => node.type === "settings-form"),
      null,
    );
    findElement(
      tree,
      (node) => node.type === "button" && node.props.children === "Change",
    ).props.onClick();
    assert.equal(harness.settingsOpened(), 1);
    const html = renderToStaticMarkup(tree);
    for (const value of [
      problem.title,
      "System Design",
      "Medium",
      "Data Modeling",
      "Caching",
      "Bitly",
      "Common at",
      `${definition.duration.defaultMinutes} min`,
      `${definition.stages.length} stages`,
    ])
      assert.ok(html.includes(value), value);
    for (const value of [
      "100 million",
      "Functional Requirements",
      "Discussion",
      "test-secret",
    ])
      assert.ok(!html.includes(value), value);
    assert.equal(button(tree).props.disabled, false);
  }));

test("Start validates saved settings, creates selected level and initial mode once, then opens Room", () =>
  browser(() => {
    saveSettings({
      provider: "openai",
      model: "gpt-4.1",
      apiKey: "",
      rememberApiKey: false,
    });
    const harness = setupHarness();
    let tree = harness.render();
    assert.equal(button(tree).props.disabled, true);
    button(tree).props.onClick();
    assert.equal(harness.urls.length, 0);
    saveSettings({
      provider: "openai",
      model: "gpt-4.1",
      apiKey: "test-key",
      rememberApiKey: false,
    });
    tree = harness.render();
    findElement(
      tree,
      (node) => node.type === "toggle-group",
    ).props.onValueChange(["staff"]);
    tree = harness.render();
    assert.deepEqual(
      findElement(tree, (node) => node.type === "toggle-group").props.value,
      ["staff"],
    );
    assert.equal(
      findElement(tree, (node) => node.type === "interaction-control"),
      null,
    );
    assert.equal(button(tree).props.disabled, false);
    button(tree).props.onClick();
    button(tree).props.onClick();
    assert.equal(harness.urls.length, 1);
    const url = new URL(harness.urls[0], "http://localhost");
    assert.equal(url.pathname, "/interview/url-shortener");
    const saved = readInterviewSession(url.searchParams.get("session"));
    assert.equal(saved.interview.targetLevel, "staff");
    assert.equal(Object.hasOwn(saved, "interactionMode"), false);
    assert.equal(saved.interview.status, "in-progress");
    assert.equal(saved.interview.stage.current, definition.stages[0].id);
    assert.equal(saved.interview.elapsedMs, undefined);
    assert.ok(
      !window.sessionStorage
        .values()
        .find((value) => value.includes('"interview"'))
        .includes("test-key"),
    );
    assert.ok(!Object.hasOwn(problem, "level"));
  }));

test("missing AI settings show Configure AI and saved settings update the summary", () =>
  browser(() => {
    saveSettings({
      provider: "openai",
      model: "gpt-4.1",
      apiKey: "",
      rememberApiKey: false,
    });
    const harness = setupHarness();
    let tree = harness.render();
    assert.equal(button(tree).props.disabled, true);
    const configure = findElement(
      tree,
      (node) =>
        node.type === "button" && node.props.children === "Configure AI",
    );
    configure.props.onClick();
    assert.equal(harness.settingsOpened(), 1);
    assert.equal(
      findElement(tree, (node) => node.type === "settings-form"),
      null,
    );
    let changes = 0;
    const unsubscribe = subscribeSettings(() => changes++);
    saveSettings({
      provider: "openai",
      model: "gpt-4.1",
      apiKey: "saved-key",
      rememberApiKey: false,
    });
    assert.equal(changes, 1);
    unsubscribe();
    tree = harness.render();
    assert.equal(button(tree).props.disabled, false);
    const html = renderToStaticMarkup(tree);
    assert.match(html, /OpenAI/);
    assert.match(html, /gpt-4.1/);
    assert.match(html, /Ready/);
    assert.ok(!html.includes("saved-key"));
  }));

test("AI readiness follows cloud keys and Ollama local configuration", () => {
  assert.match(
    aiSettingsIssue({
      provider: "anthropic",
      model: "claude-sonnet-5",
      apiKey: " ",
      rememberApiKey: false,
    }),
    /API key/,
  );
  assert.equal(
    aiSettingsIssue({
      provider: "anthropic",
      model: "claude-sonnet-5",
      apiKey: "key",
      rememberApiKey: false,
    }),
    "",
  );
  assert.match(
    aiSettingsIssue({
      provider: "ollama",
      model: "",
      baseUrl: "http://localhost:11434",
    }),
    /model/,
  );
  assert.match(
    aiSettingsIssue({
      provider: "ollama",
      model: "qwen3:8b",
      baseUrl: "bad-url",
    }),
    /URL/,
  );
  assert.equal(
    aiSettingsIssue({
      provider: "ollama",
      model: "qwen3:8b",
      baseUrl: "http://localhost:11434",
    }),
    "",
  );
});

test("Room loads the created session without an interaction mode", () =>
  browser(() => {
    const harness = setupHarness();
    let tree = harness.render();
    tree = harness.render();
    button(tree).props.onClick();
    const sessionId = new URL(
      harness.urls[0],
      "http://localhost",
    ).searchParams.get("session");
    // Sessions created before this cleanup may still contain obsolete fields.
    const session = readInterviewSession(sessionId);
    window.sessionStorage.setItem(
      `openmock:interview:${sessionId}`,
      JSON.stringify({ ...session, interactionMode: "legacy-choice" }),
    );
    const hooks = hookHarness();
    const redirects = [];
    const { ConfiguredInterviewRoom } = loadComponent(
      "src/components/configured-interview-room.tsx",
      {
        react: hooks.react,
        "next/navigation": {
          useRouter: () => ({ replace: (url) => redirects.push(url) }),
        },
        "./interview-room": { InterviewRoom: "room" },
      },
    );
    const wrapper = hooks.render(ConfiguredInterviewRoom, {
      problem,
      definition,
      sessionId,
    });
    const room = hooks.render(wrapper.type, wrapper.props);
    assert.equal(room.type, "room");
    assert.equal(Object.hasOwn(room.props, "initialMode"), false);
    assert.deepEqual(redirects, []);
  }));

test("Room timer starts paused without interaction mode state", () =>
  browser(() => {
    const hooks = hookHarness();
    const { InterviewControlsProvider } = loadComponent(
      "src/components/interview-controls-context.tsx",
      {
        react: { ...hooks.react, createContext: () => "controls-context" },
        "@/components/ui/tooltip": { TooltipProvider: "tooltips" },
      },
    );
    let tree = hooks.render(InterviewControlsProvider, {
      children: null,
    });
    let controls = tree.props.children.props.value;
    assert.equal(Object.hasOwn(controls, "mode"), false);
    assert.equal(Object.hasOwn(controls, "setMode"), false);
    assert.equal(controls.paused, true);
    assert.equal(controls.elapsed(), 0);
    controls.toggleTimer();
    tree = hooks.render(InterviewControlsProvider, {
      children: null,
    });
    controls = tree.props.children.props.value;
    assert.equal(controls.paused, false);
  }));

test("shared inline AI form preserves saved-key masking and Remember API key behavior", () =>
  browser(() => {
    saveSettings({
      provider: "openai",
      model: "gpt-4.1",
      apiKey: "existing-key",
      rememberApiKey: false,
    });
    const hooks = hookHarness();
    let saved = 0;
    const { AISettingsForm } = loadComponent(
      "src/components/settings-dialog.tsx",
      {
        ...primitives,
        react: hooks.react,
        "next-themes": {
          useTheme: () => ({ theme: "light", setTheme: () => {} }),
        },
        "@/components/ui/dialog": Object.fromEntries(
          [
            "Dialog",
            "DialogContent",
            "DialogDescription",
            "DialogHeader",
            "DialogTitle",
          ].map((name) => [name, "div"]),
        ),
        "@/components/ui/input": { Input: "input" },
        "@/components/ui/switch": { Switch: "switch" },
        "@/components/ui/select": Object.fromEntries(
          [
            "Select",
            "SelectContent",
            "SelectGroup",
            "SelectItem",
            "SelectTrigger",
            "SelectValue",
          ].map((name) => [name, name.toLowerCase()]),
        ),
      },
    );
    const props = { initialSettings: readSettings(), onSaved: () => saved++ };
    let tree = hooks.render(AISettingsForm, props);
    findElement(
      tree,
      (node) => node.props.id === "settings-interviewer-voice",
    ).props.onCheckedChange(false);
    tree = hooks.render(AISettingsForm, props);
    for (const provider of ["anthropic", "openai"]) {
      findElement(
        tree,
        (node) =>
          node.type === "select" &&
          ["openai", "anthropic"].includes(node.props.value),
      ).props.onValueChange(provider);
      tree = hooks.render(AISettingsForm, props);
      assert.equal(
        findElement(
          tree,
          (node) => node.props.id === "settings-interviewer-voice",
        ).props.checked,
        false,
      );
    }
    let key = findElement(tree, (node) => node.props.id === "settings-api-key");
    assert.equal(key.props.type, "password");
    assert.equal(key.props.value, "");
    assert.match(key.props.placeholder, /Key saved/);
    key.props.onChange({ target: { value: "replacement-key" } });
    tree = hooks.render(AISettingsForm, props);
    findElement(
      tree,
      (node) => node.props.id === "settings-remember",
    ).props.onCheckedChange(true);
    tree = hooks.render(AISettingsForm, props);
    findElement(
      tree,
      (node) => node.type === "button" && node.props.children === "Save",
    ).props.onClick();
    assert.equal(saved, 1);
    assert.equal(readSettings().apiKey, "replacement-key");
    assert.equal(readSettings().rememberApiKey, true);
    assert.equal(readSettings().interviewerVoiceEnabled, false);
    assert.equal(
      window.localStorage.getItem("openmock:api-key:openai"),
      "replacement-key",
    );
    assert.equal(
      window.sessionStorage.getItem("openmock:api-key:openai"),
      null,
    );
  }));

test("Setup reads default level and interview mode from the definition", () =>
  browser(() => {
    saveSettings({
      provider: "ollama",
      model: "qwen3:8b",
      baseUrl: "http://localhost:11434",
    });
    const configured = {
      ...definition,
      defaultLevel: "junior",
      defaultMode: "mock",
    };
    const harness = setupHarness(configured);
    const tree = harness.render();
    const levels = findElement(tree, (node) => node.type === "toggle-group");
    assert.deepEqual(levels.props.value, ["junior"]);
    button(tree).props.onClick();
    const id = harness.urls[0].split("session=")[1];
    const stored = readInterviewSession(id);
    assert.equal(stored.interview.targetLevel, "junior");
    assert.equal(stored.interview.mode, "mock");
  }));

test("Setup selects the definition interview mode without another interaction choice", () =>
  browser(() => {
    saveSettings({
      provider: "ollama",
      model: "qwen3:8b",
      baseUrl: "http://localhost:11434",
    });
    const harness = setupHarness();
    let tree = harness.render();
    const modeGroup = (tree) =>
      findElement(
        tree,
        (node) => node.props["aria-labelledby"] === "interview-mode-label",
      );
    assert.deepEqual(modeGroup(tree).props.value, [definition.defaultMode]);
    assert.deepEqual(
      modeGroup(tree).props.children.map((item) => item.props.value),
      definition.modes,
    );
    modeGroup(tree).props.onValueChange(["mock"]);
    tree = harness.render();
    assert.deepEqual(modeGroup(tree).props.value, ["mock"]);
    assert.equal(
      findElement(tree, (node) => node.type === "interaction-control"),
      null,
    );
    modeGroup(tree).props.onValueChange([]);
    tree = harness.render();
    assert.deepEqual(modeGroup(tree).props.value, ["mock"]);
    button(tree).props.onClick();
    const stored = readInterviewSession(harness.urls[0].split("session=")[1]);
    assert.equal(stored.interview.mode, "mock");
    assert.equal(Object.hasOwn(stored, "interactionMode"), false);
  }));

test("Setup renders only definition-supported interview modes and ignores unsupported choices", () =>
  browser(() => {
    const configured = {
      ...definition,
      modes: ["practice"],
      defaultMode: "practice",
    };
    const harness = setupHarness(configured);
    const modeGroup = (tree) =>
      findElement(
        tree,
        (node) => node.props["aria-labelledby"] === "interview-mode-label",
      );
    let tree = harness.render();
    assert.deepEqual(
      modeGroup(tree).props.children.map((item) => item.props.value),
      ["practice"],
    );
    modeGroup(tree).props.onValueChange(["mock"]);
    tree = harness.render();
    assert.deepEqual(modeGroup(tree).props.value, ["practice"]);
  }));
