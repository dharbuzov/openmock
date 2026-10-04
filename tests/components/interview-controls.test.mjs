import { test } from "node:test";
import assert from "node:assert/strict";
import { load, storage } from "../register-typescript.mjs";
import {
  hookHarness,
  loadComponent,
  findElement,
} from "../helpers/components.mjs";

test("new interviews use the saved voice default and speaker changes stay in the session", () => {
  const previousWindow = globalThis.window;
  globalThis.window = { localStorage: storage(), sessionStorage: storage() };
  try {
    const { readSettings, saveSettings } = load(
      "../src/lib/settings/storage.ts",
    );
    saveSettings({ ...readSettings(), interviewerVoiceEnabled: false });
    function room() {
      const hooks = hookHarness();
      const { InterviewControlsProvider } = loadComponent(
        "src/components/interview-controls-context.tsx",
        {
          react: hooks.react,
          "@/components/ui/tooltip": { TooltipProvider: "div" },
        },
      );
      return () =>
        findElement(
          hooks.render(InterviewControlsProvider, { children: null }),
          (node) => typeof node.props?.value?.voiceEnabled === "boolean",
        ).props.value;
    }
    const first = room();
    assert.equal(first().voiceEnabled, false);
    first().setVoiceEnabled(true);
    assert.equal(first().voiceEnabled, true);
    assert.equal(readSettings().interviewerVoiceEnabled, false);
    assert.equal(room()().voiceEnabled, false);
    saveSettings({ ...readSettings(), interviewerVoiceEnabled: true });
    const next = room();
    assert.equal(next().voiceEnabled, true);
    next().setVoiceEnabled(false);
    assert.equal(next().voiceEnabled, false);
    assert.equal(readSettings().interviewerVoiceEnabled, true);
    assert.equal(room()().voiceEnabled, true);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

const { InterviewTimer, formatElapsed } = load("../src/lib/interview/timer.ts");

const { interviewContext } = load("../src/lib/ai/prompts.ts");

test("timer runs, freezes through repeated pauses, and resumes without resetting", () => {
  let now = 0;
  const timer = new InterviewTimer(() => now);
  timer.resume();
  now = 1471000;
  assert.equal(formatElapsed(timer.elapsed()), "24:31");
  timer.pause();
  now += 90000;
  timer.pause();
  assert.equal(formatElapsed(timer.elapsed()), "24:31");
  timer.resume();
  timer.resume();
  now += 2000;
  assert.equal(formatElapsed(timer.elapsed()), "24:33");
});

test("AI time context uses active interview time rather than paused wall time", () => {
  const data = JSON.parse(
    interviewContext({
      problem: { id: "example", title: "Example", content: "Explain." },
      interview: {
        startedAt: new Date(0).toISOString(),
        elapsedMs: 120000,
        stage: { current: "intro" },
      },
      definition: {
        duration: { defaultMinutes: 45 },
        evaluation: { competencies: [] },
      },
    }),
  );
  assert.deepEqual(data.time, { elapsedMinutes: 2, remainingMinutes: 43 });
});

test("header input hint reads the shared recording state and returns to idle after transcription", () => {
  const providerHooks = hookHarness();
  const { InterviewControlsProvider } = loadComponent(
    "src/components/interview-controls-context.tsx",
    {
      react: providerHooks.react,
      "@/components/ui/tooltip": { TooltipProvider: "div" },
    },
  );
  const controls = () =>
    findElement(
      providerHooks.render(InterviewControlsProvider, { children: null }),
      (node) => typeof node.props?.value?.recordingState === "string",
    ).props.value;
  let value = controls();
  const headerHooks = hookHarness();
  const { InterviewControls } = loadComponent(
    "src/components/interview-controls.tsx",
    {
      react: headerHooks.react,
      "./interview-controls-context": { useInterviewControls: () => value },
      "./interview-session-context": {
        useInterviewSession: () => ({
          definition: { duration: { defaultMinutes: 60 } },
        }),
      },
      "@/components/ui/button": { Button: "button" },
      "@/components/ui/spinner": { Spinner: "spinner" },
      "@/components/ui/tooltip": {
        Tooltip: "div",
        TooltipTrigger: "div",
        TooltipContent: "div",
      },
    },
  );
  const hint = () =>
    findElement(
      headerHooks.render(InterviewControls, {}),
      (node) => node.props.role === "status",
    );
  assert.match(hint().props.children[1], /Type or press/);
  value.setRecordingState("recording");
  value = controls();
  assert.equal(hint().props.children[1], "Listening…");
  for (const state of ["transcribing-for-edit", "transcribing-for-send"]) {
    value.setRecordingState(state);
    value = controls();
    assert.equal(hint().props.children[1], "Transcribing…");
  }
  value.setRecordingState("idle");
  value = controls();
  assert.match(hint().props.children[1], /Type or press/);
  providerHooks.dispose();
  headerHooks.dispose();
});
