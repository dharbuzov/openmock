import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
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
const { finalTranscript } = load("../src/lib/voice/browser.ts");
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

test("speech transcription uses only new final results", () => {
  assert.equal(
    finalTranscript({
      resultIndex: 1,
      results: [
        { isFinal: true, 0: { transcript: "old" } },
        { isFinal: true, 0: { transcript: "I propose" } },
        { isFinal: false, 0: { transcript: "interim" } },
        { isFinal: true, 0: { transcript: "a queue" } },
      ],
    }),
    "I propose a queue",
  );
});

function voiceHarness(controls) {
  const slots = [];
  const effects = [];
  let index = 0,
    dirty = false;
  const react = {
    useState(initial) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = initial;
      return [
        slots[slot],
        (value) => {
          const next = typeof value === "function" ? value(slots[slot]) : value;
          if (!Object.is(next, slots[slot])) {
            slots[slot] = next;
            dirty = true;
          }
        },
      ];
    },
    useRef(initial) {
      const slot = index++;
      return (slots[slot] ??= { current: initial });
    },
    useEffectEvent(callback) {
      const slot = index++;
      slots[slot] ??= {
        callback,
        fn: (...args) => slots[slot].callback(...args),
      };
      slots[slot].callback = callback;
      return slots[slot].fn;
    },
    useEffect(callback, dependencies) {
      const slot = index++;
      if (
        !slots[slot] ||
        dependencies.some(
          (dep, i) => !Object.is(dep, slots[slot].dependencies[i]),
        )
      ) {
        effects.push(() => {
          slots[slot]?.cleanup?.();
          slots[slot] = { dependencies, cleanup: callback() };
        });
      }
    },
  };
  const source = readFileSync("src/components/use-interview-voice.ts", "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) => {
      if (name === "react") return react;
      if (name === "./interview-controls-context")
        return { useInterviewControls: () => controls };
      if (name === "@/lib/voice/browser")
        return load("../src/lib/voice/browser.ts");
      throw new Error(`Unexpected import ${name}`);
    },
    loadedModule,
    loadedModule.exports,
  );
  return {
    render(props) {
      let value;
      for (let count = 0; count < 12; count++) {
        index = 0;
        dirty = false;
        value = loadedModule.exports.useInterviewVoice(props);
        while (effects.length) effects.shift()();
        if (!dirty) return value;
      }
      throw new Error("Voice hook did not settle");
    },
    dispose() {
      slots.forEach((slot) => slot?.cleanup?.());
    },
  };
}

test("Chat dictation, Live submission, TTS muting, and microphone cleanup stay separate", () => {
  const originalWindow = globalThis.window,
    originalDocument = globalThis.document;
  const originalUtterance = globalThis.SpeechSynthesisUtterance;
  const recognitions = [],
    playback = [],
    dictated = [],
    liveAnswers = [];
  let cancellations = 0;
  class Recognition {
    constructor() {
      recognitions.push(this);
    }
    start() {
      this.started = true;
    }
    abort() {
      this.aborted = true;
      this.onend?.();
    }
    result(text) {
      this.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: text } }],
      });
    }
  }
  const controls = {
    mode: "chat",
    voiceEnabled: true,
    speechAvailable: true,
    playbackAvailable: true,
    setMode: (mode) => {
      controls.mode = mode;
    },
  };
  const harness = voiceHarness(controls);
  const props = {
    messages: [],
    busy: false,
    active: true,
    onDictation: (text) => dictated.push(text),
    onLiveAnswer: (text) => liveAnswers.push(text),
  };
  try {
    globalThis.window = {
      SpeechRecognition: Recognition,
      speechSynthesis: {
        speak: (utterance) => {
          playback.push(utterance);
          utterance.onstart?.();
        },
        cancel: () => cancellations++,
      },
    };
    globalThis.document = { documentElement: { lang: "en" } };
    globalThis.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
      }
    };
    let state = harness.render(props);
    assert.equal(recognitions.length, 0);
    state.toggleMicrophone();
    harness.render(props);
    assert.equal(recognitions.at(-1).continuous, false);
    recognitions.at(-1).result("typed via speech");
    harness.render(props);
    assert.deepEqual(dictated, ["typed via speech"]);
    assert.deepEqual(liveAnswers, []);
    controls.mode = "live";
    harness.render(props);
    assert.equal(recognitions.at(-1).continuous, true);
    recognitions.at(-1).result("live answer");
    props.busy = true;
    harness.render(props);
    assert.deepEqual(liveAnswers, ["live answer"]);
    assert.equal(recognitions.at(-1).aborted, true);
    props.messages = [
      { id: "reply", role: "interviewer", content: "Explain your trade-offs." },
    ];
    props.busy = false;
    harness.render(props);
    assert.equal(playback[0].text, "Explain your trade-offs.");
    assert.equal(recognitions.at(-1).aborted, true);
    playback[0].onend();
    harness.render(props);
    assert.equal(recognitions.at(-1).started, true);
    controls.voiceEnabled = false;
    harness.render(props);
    props.messages = [
      ...props.messages,
      { id: "reply2", role: "interviewer", content: "Muted." },
    ];
    harness.render(props);
    assert.equal(playback.length, 1);
    assert.ok(cancellations > 0);
    recognitions.at(-1).onerror({ error: "not-allowed" });
    state = harness.render(props);
    assert.equal(controls.mode, "chat");
    assert.match(state.error, /permissions/);
  } finally {
    harness.dispose();
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    globalThis.SpeechSynthesisUtterance = originalUtterance;
  }
});
