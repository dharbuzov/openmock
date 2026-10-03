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

function conversation() {
  const hooks = hookHarness();
  let state = {
    interview: startInterview(problem, { definition }),
    operation: null,
  };
  const operations = new SessionOperations(state.interview, (next) => {
    state = next;
  });
  const requests = [];
  let voiceProps;
  let stoppedPlayback = 0;
  const voice = {
    listening: false,
    transcribing: false,
    speaking: false,
    partialTranscript: "",
    recordingSeconds: 0,
    error: "",
    stopPlayback: () => stoppedPlayback++,
    toggleMicrophone: () => {},
    retry: () => {},
  };
  const overrides = {
    react: hooks.react,
    "./current-stage-badge": { CurrentStageBadge: "stage" },
    "./use-interview-voice": {
      useInterviewVoice: (props) => {
        voiceProps = props;
        return voice;
      },
    },
    "./interview-controls-context": {
      useInterviewControls: () => ({
        mode: "chat",
        setMode: () => {},
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
      node.props.messageId?.startsWith("response-"),
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
  assert.equal(h.state().interview.messages.length, 1);
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
  tree = h.render();
  assert.equal(tree.props["data-conversation-state"], "interviewer-streaming");
  assert.equal(responseSlot(tree).key, key);
  assert.equal(
    h.state().interview.messages.length,
    1,
    "partial response remains UI-only",
  );
  h.requests[0].resolve("What constraints matter?");
  await flush();
  tree = h.render();
  assert.equal(tree.props["data-conversation-state"], "idle");
  assert.equal(responseSlot(tree).key, key);
  assert.equal(h.state().interview.messages.length, 2);
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
  assert.equal(h.state().interview.messages.length, 1);
  assert.equal(h.requests[1].snapshot, h.requests[0].snapshot);
  h.requests[1].resolve();
  await retry;
  assert.equal(h.state().interview.messages.length, 2);
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
  assert.equal(h.state().interview.messages.length, 2);
});

test("composer shows real interim text, listening time, transcribing locks and interruptible speaking", async () => {
  const h = conversation();
  h.voice.listening = true;
  h.voice.partialTranscript = "I would clarify";
  h.voice.recordingSeconds = 8;
  let tree = h.render();
  assert.equal(tree.props["data-conversation-state"], "user-listening");
  assert.equal(textarea(tree).props.value, "I would clarify");
  assert.equal(textarea(tree).props.readOnly, true);
  assert.ok(
    findElement(tree, (node) => node.props["aria-label"] === "Stop recording"),
  );
  assert.equal(sendButton(tree).props.disabled, true);
  h.voice.listening = false;
  h.voice.transcribing = true;
  tree = h.render();
  assert.equal(tree.props["data-conversation-state"], "transcribing");
  assert.equal(textarea(tree).props.disabled, true);
  assert.equal(sendButton(tree).props.disabled, true);
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
  h.voice.listening = true;
  h.render();
  h.voiceProps().onLiveAnswer("Final utterance");
  await flush();
  assert.equal(
    h.state().interview.messages.length,
    1,
    "final speech bypasses the stale listening render safely",
  );
  assert.equal(h.state().interview.messages[0].content, "Final utterance");
  h.requests[0].resolve();
  await flush();
});
