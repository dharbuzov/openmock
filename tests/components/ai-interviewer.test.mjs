import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../register-typescript.mjs";
import { loadDefinition } from "../content-fixtures.mjs";
import {
  loadComponent,
  hookHarness,
  findElement,
} from "../helpers/components.mjs";

const { SessionOperations } = load(
  "../src/lib/interview/session-operations.ts",
);
const { startInterview, applyInterviewTurn } = load(
  "../src/lib/interview/engine.ts",
);
const definition = loadDefinition("behavioral");
const problem = { id: "conflict", interview: definition.id };
const flush = () => new Promise((resolve) => setImmediate(resolve));
const scrollerParts = [
  "MessageScrollerProvider",
  "MessageScroller",
  "MessageScrollerViewport",
  "MessageScrollerContent",
  "MessageScrollerItem",
  "MessageScrollerButton",
];

function conversation(fresh = false) {
  const hooks = hookHarness();
  let state = {
    interview: fresh
      ? startInterview(problem, { definition })
      : applyInterviewTurn(
          startInterview(problem, { definition }),
          definition,
          {
            message: "Opening question.",
            stageComplete: false,
            observations: [],
          },
        ),
    operation: null,
  };
  const operations = new SessionOperations(state.interview, (next) => {
    state = next;
  });
  const requests = [];
  let voiceProps;
  let stoppedPlayback = 0;
  const speechChunks = [];
  const shortcutLogs = [];
  let speechFinished = 0;
  const voice = {
    recordingState: "idle",
    microphoneStream: null,
    stopRecording: () => {},
    startRecording: () => {},
    isRecordingPending: () => false,
    stopAndReview: () => {},
    stopAndSend: () => {},
    cancelRecording: () => {},
    listening: false,
    transcribing: false,
    speaking: false,
    partialTranscript: "",
    recordingSeconds: 0,
    error: "",
    stopPlayback: () => stoppedPlayback++,
    beginResponse: () => {
      stoppedPlayback++;
      return {
        push: (text) => speechChunks.push(text),
        finish: () => speechFinished++,
        cancel: () => stoppedPlayback++,
      };
    },
    toggleMicrophone: () => {},
    retry: () => {},
  };
  const overrides = {
    react: hooks.react,
    "@/lib/logging/logger": {
      logger: { debug: (metadata) => shortcutLogs.push(metadata) },
    },
    "./recording-controls": { RecordingControls: "recording-controls" },
    "@/components/ui/spinner": { Spinner: "spinner" },
    "./current-stage-badge": { CurrentStageBadge: "stage" },
    "./use-interview-voice": {
      useInterviewVoice: (props) => {
        voiceProps = props;
        return voice;
      },
    },
    "./interview-controls-context": {
      useInterviewControls: () => ({
        voiceEnabled: true,
        setVoiceEnabled: () => {},
        speechAvailable: true,
        playbackAvailable: true,
      }),
    },
    "@/components/interview-session-context": {
      useInterviewSession: () => ({
        ...state,
        problem,
        definition,
        beginOperation: operations.begin,
        commitOperation: operations.commit,
        endOperation: operations.end,
        isCurrentOperation: operations.isCurrent,
      }),
      useCaptureWorkspace: () => () => ({ type: "none" }),
    },
    "@/components/settings-provider": { useOpenSettings: () => () => {} },
    "@/lib/settings/storage": {
      readSettings: () => ({ provider: "ollama", model: "test" }),
      subscribeSettings: () => () => {},
    },
    "@/lib/settings/types": { aiSettingsIssue: () => "" },
    "@/components/ui/button": { Button: "button" },
    "@/components/ui/textarea": { Textarea: "textarea" },
    "@/components/ui/tooltip": {
      Tooltip: "div",
      TooltipTrigger: "div",
      TooltipContent: "div",
    },
    "@/components/ui/empty": Object.fromEntries(
      [
        "Empty",
        "EmptyHeader",
        "EmptyTitle",
        "EmptyDescription",
        "EmptyContent",
      ].map((name) => [name, "div"]),
    ),
    "@/components/ui/message-scroller": Object.fromEntries(
      scrollerParts.map((name) => [name, name]),
    ),
    "@/lib/interview/runner": {
      processCandidateMessage: (
        _settings,
        interview,
        _problem,
        _definition,
        snapshot,
        signal,
        onMessage,
      ) =>
        new Promise((resolve, reject) =>
          requests.push({
            interview,
            snapshot,
            signal,
            onMessage,
            resolve: (message = "Tell me more.") =>
              resolve(
                applyInterviewTurn(interview, definition, {
                  message,
                  stageComplete: false,
                  observations: [],
                }),
              ),
            reject,
          }),
        ),
    },
  };
  const { AIInterviewer } = loadComponent(
    "src/components/ai-interviewer.tsx",
    overrides,
  );
  const render = () => hooks.render(AIInterviewer, {});
  return {
    render,
    voice,
    requests,
    state: () => state,
    voiceProps: () => voiceProps,
    stoppedPlayback: () => stoppedPlayback,
    speechChunks,
    shortcutLogs,
    dispose: () => {
      hooks.dispose();
      operations.cancel();
    },
    speechFinished: () => speechFinished,
  };
}
const textarea = (tree) =>
  findElement(tree, (node) => node.type === "textarea");
const sendButton = (tree) =>
  findElement(
    tree,
    (node) => node.type === "button" && node.props.children === "Send",
  );
const responseSlot = (tree) =>
  findElement(
    tree,
    (node) =>
      node.type === "MessageScrollerItem" &&
      node.props.messageId?.startsWith("response-") &&
      !node.props.messageId?.startsWith("response-opening-"),
  );
function submit(harness, text) {
  textarea(harness.render()).props.onChange({ target: { value: text } });
  const form = findElement(harness.render(), (node) => node.type === "form");
  form.props.onSubmit({ preventDefault() {} });
  return form;
}

test("typed answers reserve one stable Thinking/streaming/final slot and lock repeated Send", async () => {
  const h = conversation();
  assert.equal(h.render().props["data-conversation-state"], "idle");
  textarea(h.render()).props.onChange({ target: { value: "My approach" } });
  assert.equal(h.render().props["data-conversation-state"], "user-typing");
  const form = submit(h, "My approach");
  form.props.onSubmit({ preventDefault() {} });
  let tree = h.render();
  assert.equal(h.state().interview.messages.length, 2);
  assert.equal(tree.props["data-conversation-state"], "interviewer-thinking");
  const key = responseSlot(tree).key;
  assert.equal(
    findElement(tree, (node) => node.props.role === "status").props.children,
    "Thinking…",
  );
  assert.equal(textarea(tree).props.value, "My approach");
  assert.equal(textarea(tree).props.disabled, true);
  assert.equal(sendButton(tree).props.disabled, true);
  assert.equal(
    findElement(tree, (node) => node.props["aria-label"] === "Dictate answer")
      .props.disabled,
    true,
  );
  await flush();
  assert.equal(h.requests.length, 1);
  h.requests[0].onMessage("What constraints");
  assert.deepEqual(
    h.speechChunks,
    ["What constraints"],
    "speech receives partial text while the LLM request is still pending",
  );
  assert.equal(h.speechFinished(), 0);
  tree = h.render();
  assert.equal(tree.props["data-conversation-state"], "interviewer-streaming");
  assert.equal(responseSlot(tree).key, key);
  assert.equal(
    h.state().interview.messages.length,
    2,
    "partial response remains UI-only",
  );
  h.requests[0].resolve("What constraints matter?");
  await flush();
  tree = h.render();
  assert.equal(h.speechFinished(), 1);
  assert.equal(tree.props["data-conversation-state"], "idle");
  assert.equal(responseSlot(tree).key, key);
  assert.equal(h.state().interview.messages.length, 3);
  assert.equal(textarea(tree).props.value, "");
  assert.equal(
    findElement(tree, (node) => node.type === "h2").props.children,
    "AI Interviewer",
  );
  assert.equal(
    responseSlot(tree).props.children[0].props.children,
    "Interviewer",
  );
});

test("provider errors are system feedback and Retry preserves one candidate message and workspace", async () => {
  const h = conversation();
  submit(h, "Preserve this answer");
  await flush();
  h.requests[0].onMessage("Incomplete output");
  h.requests[0].reject(Error("network failed"));
  await flush();
  let tree = h.render();
  assert.equal(tree.props["data-conversation-state"], "error");
  assert.equal(responseSlot(tree), null);
  assert.match(
    findElement(tree, (node) => node.props.role === "alert").props.children,
    /AI provider/,
  );
  assert.equal(textarea(tree).props.value, "Preserve this answer");
  assert.equal(textarea(tree).props.disabled, false);
  const retry = findElement(
    tree,
    (node) => node.type === "button" && node.props.children === "Retry",
  ).props.onClick();
  await flush();
  assert.equal(h.requests.length, 2);
  assert.equal(h.state().interview.messages.length, 2);
  assert.equal(h.requests[1].snapshot, h.requests[0].snapshot);
  h.requests[1].resolve();
  await retry;
  assert.equal(h.state().interview.messages.length, 3);
  assert.equal(h.render().props["data-conversation-state"], "idle");
});

test("nonstreaming responses still replace Thinking in the same slot", async () => {
  const h = conversation();
  submit(h, "Answer");
  const key = responseSlot(h.render()).key;
  await flush();
  h.requests[0].resolve();
  await flush();
  assert.equal(responseSlot(h.render()).key, key);
  assert.equal(h.state().interview.messages.length, 3);
});

test("composer shows recording time and transcription locks; dictated text uses typed Send", async () => {
  const h = conversation();
  h.voice.recordingState = "recording";
  h.voice.listening = true;
  h.voice.partialTranscript = "I would clarify";
  h.voice.recordingSeconds = 8;
  let tree = h.render();
  assert.equal(tree.props["data-conversation-state"], "user-listening");
  assert.equal(textarea(tree), null);
  assert.equal(
    findElement(tree, (node) => node.type === "recording-controls").props
      .seconds,
    8,
  );
  assert.equal(sendButton(tree), null);
  h.voice.listening = false;
  h.voice.recordingState = "transcribing-for-edit";
  h.voice.transcribing = true;
  tree = h.render();
  assert.equal(tree.props["data-conversation-state"], "transcribing");
  assert.equal(textarea(tree), null);
  assert.equal(sendButton(tree), null);
  assert.ok(findElement(tree, (node) => node.type === "spinner"));
  h.voice.recordingState = "idle";
  h.voice.transcribing = false;
  h.voice.partialTranscript = "";
  h.voice.speaking = true;
  tree = h.render();
  assert.equal(tree.props["data-conversation-state"], "interviewer-speaking");
  assert.equal(
    findElement(tree, (node) => node.props["aria-label"] === "Dictate answer")
      .props.disabled,
    false,
  );
  assert.equal(textarea(tree).props.disabled, false);
  h.voice.speaking = false;
  h.render();
  h.voiceProps().onDictation("Final utterance");
  assert.equal(
    h.state().interview.messages.length,
    1,
    "dictation only fills the draft",
  );
  const form = findElement(h.render(), (node) => node.type === "form");
  form.props.onSubmit({ preventDefault() {} });
  await flush();
  assert.equal(
    h.state().interview.messages.length,
    2,
    "dictated text uses the same submission path",
  );
  assert.equal(h.state().interview.messages[1].content, "Final utterance");
  h.requests[0].resolve();
  await flush();
});

test("recorded Send uses the existing candidate path without putting transcript in the textarea", async () => {
  const h = conversation();
  textarea(h.render()).props.onChange({ target: { value: "Typed context" } });
  h.voice.recordingState = "transcribing-for-send";
  h.voice.transcribing = true;
  h.render();
  h.voiceProps().onRecordedAnswer("Recorded answer");
  h.voice.recordingState = "idle";
  h.voice.transcribing = false;
  const tree = h.render();
  assert.equal(h.state().interview.messages.length, 2);
  assert.equal(
    h.state().interview.messages[1].content,
    "Typed context Recorded answer",
  );
  assert.equal(textarea(tree).props.value, "");
  assert.equal(textarea(tree).props.disabled, true);
  await flush();
  assert.equal(h.requests.length, 1);
  h.requests[0].resolve();
  await flush();
  assert.equal(h.state().interview.messages.length, 3);
});

test("recording and transcription failure preserve the original typed draft", () => {
  const h = conversation();
  textarea(h.render()).props.onChange({ target: { value: "Keep my draft" } });
  h.voice.listening = true;
  h.voice.recordingState = "recording";
  assert.equal(textarea(h.render()), null);
  h.voice.listening = false;
  h.voice.recordingState = "idle";
  h.voice.error = "Could not transcribe";
  assert.equal(textarea(h.render()).props.value, "Keep my draft");
  assert.equal(h.state().interview.messages.length, 1);
});

test("recording Enter captures before focused Cancel and uses the Send action", () => {
  const h = conversation();
  let sent = 0,
    cancelled = 0;
  h.voice.stopAndSend = () => sent++;
  h.voice.cancelRecording = () => cancelled++;
  h.voice.listening = true;
  h.voice.recordingState = "recording";
  const form = findElement(h.render(), (node) => node.type === "form");
  let prevented = 0,
    stopped = 0;
  const event = {
    key: "Enter",
    nativeEvent: { isComposing: false },
    preventDefault() {
      prevented++;
    },
    stopPropagation() {
      stopped++;
    },
  };
  form.props.onKeyDownCapture(event);
  assert.equal(sent, 1);
  assert.equal(cancelled, 0);
  assert.equal(prevented, 1);
  assert.equal(stopped, 1);
  form.props.onKeyDownCapture({ ...event, repeat: true });
  assert.equal(sent, 1);
  form.props.onKeyDownCapture({ ...event, key: "Escape" });
  assert.equal(cancelled, 1);
  h.voice.listening = false;
  h.voice.transcribing = true;
  const pending = findElement(h.render(), (node) => node.type === "form");
  pending.props.onKeyDownCapture(event);
  pending.props.onSubmit({ preventDefault() {} });
  assert.equal(sent, 1);
  assert.equal(h.state().interview.messages.length, 1);
});

test("one room shortcut listener survives renders, matches physical M, and logs ignored reasons", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    "document",
  );
  const listeners = new Set();
  let room = true;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener(name, callback, capture) {
        assert.equal(name, "keydown");
        assert.equal(capture, true);
        listeners.add(callback);
      },
      removeEventListener(name, callback, capture) {
        assert.equal(capture, true);
        listeners.delete(callback);
      },
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { querySelector: () => (room ? {} : null) },
  });
  const h = conversation();
  let starts = 0,
    reviews = 0,
    prevented = 0,
    stopped = 0;
  h.voice.startRecording = () => starts++;
  h.voice.stopAndReview = () => reviews++;
  const key = (overrides = {}) => {
    const event = {
      key: "ь",
      code: "KeyM",
      ctrlKey: true,
      preventDefault() {
        prevented++;
      },
      stopImmediatePropagation() {
        stopped++;
      },
      ...overrides,
    };
    for (const listener of listeners) listener(event);
  };
  try {
    h.render();
    assert.equal(listeners.size, 1);
    key();
    assert.equal(starts, 1);
    h.voice.recordingState = "recording";
    h.voice.listening = true;
    h.render();
    h.render();
    assert.equal(listeners.size, 1);
    key({ ctrlKey: false, metaKey: true });
    assert.equal(reviews, 1);
    h.voice.listening = false;
    h.voice.transcribing = true;
    h.voice.recordingState = "transcribing-for-edit";
    h.render();
    key();
    key();
    assert.equal(reviews, 1);
    assert.equal(starts, 1);
    assert.equal(h.shortcutLogs.at(-1).ignoredReason, "transcribing");
    h.voice.transcribing = false;
    h.voice.recordingState = "idle";
    h.voice.isRecordingPending = () => true;
    h.render();
    key();
    assert.equal(
      h.shortcutLogs.at(-1).ignoredReason,
      "microphone-request-pending",
    );
    h.voice.isRecordingPending = () => false;
    h.voice.speaking = true;
    h.render();
    key();
    assert.equal(
      starts,
      2,
      "playback does not silently block microphone input",
    );
    room = false;
    key();
    assert.equal(starts, 2);
    assert.equal(prevented, stopped);
  } finally {
    h.dispose();
    assert.equal(listeners.size, 0);
    if (originalWindow)
      Object.defineProperty(globalThis, "window", originalWindow);
    else delete globalThis.window;
    if (originalDocument)
      Object.defineProperty(globalThis, "document", originalDocument);
    else delete globalThis.document;
  }
});

test("fresh interview streams its opening into the first ordinary transcript slot without a candidate", async () => {
  const h = conversation(true);
  h.render();
  const tree = h.render();
  assert.equal(h.state().operation, "opening");
  assert.equal(h.state().interview.messages.length, 0);
  assert.equal(textarea(tree).props.disabled, true);
  const slot = findElement(
    tree,
    (node) =>
      node.type === "MessageScrollerItem" &&
      node.props.messageId?.startsWith("response-opening-"),
  );
  assert.ok(slot);
  h.render();
  await flush();
  assert.equal(h.requests.length, 1);
  h.requests[0].onMessage("Tell me about");
  assert.deepEqual(h.speechChunks, ["Tell me about"]);
  h.requests[0].resolve("Tell me about a disagreement with a teammate.");
  await flush();
  const committed = h.render();
  const finalSlot = findElement(
    committed,
    (node) => node.props.messageId === slot.props.messageId,
  );
  assert.equal(finalSlot.key, slot.key);
  assert.equal(h.state().interview.messages.length, 1);
  assert.equal(h.state().interview.messages[0].role, "interviewer");
  assert.equal(h.state().interview.stage.current, definition.stages[0].id);
  assert.equal(h.speechFinished(), 1);
  assert.equal(textarea(committed).props.disabled, false);
  h.render();
  await flush();
  assert.equal(h.requests.length, 1);
});

test("failed opening retries without inventing a candidate or duplicate opening", async () => {
  const h = conversation(true);
  h.render();
  await flush();
  h.requests[0].reject(Error("offline"));
  await flush();
  let tree = h.render();
  assert.equal(h.state().interview.messages.length, 0);
  assert.equal(h.requests.length, 1);
  findElement(
    tree,
    (node) => node.type === "button" && node.props.children === "Retry",
  ).props.onClick();
  await flush();
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve();
  await flush();
  h.render();
  assert.equal(h.state().interview.messages.length, 1);
  assert.equal(h.state().interview.messages[0].role, "interviewer");
});

test("unmounting during opening discards late output", async () => {
  const h = conversation(true);
  h.render();
  await flush();
  assert.equal(h.requests.length, 1);
  h.dispose();
  assert.equal(h.requests[0].signal.aborted, true);
  h.requests[0].resolve("Late opening");
  await flush();
  assert.equal(h.state().interview.messages.length, 0);
  assert.equal(h.speechFinished(), 0);
});
