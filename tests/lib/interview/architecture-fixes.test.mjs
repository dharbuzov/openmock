import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { load, storage } from "../../register-typescript.mjs";

const { SessionOperations } = load(
  "../src/lib/interview/session-operations.ts",
);
const { captureWorkspaceSnapshot } = load("../src/lib/interview/workspace.ts");
const {
  startInterview,
  acceptCandidateMessage,
  buildInterviewContext,
  completeInterview,
} = load("../src/lib/interview/engine.ts");
const { LocalStorage } = load("../src/lib/storage/local-storage.ts");
const { saveEvaluation, readEvaluationValue, parseEvaluation } = load(
  "../src/lib/interview/evaluation-storage.ts",
);
import { loadDefinition } from "../../content-fixtures.mjs";
const definition = loadDefinition("behavioral");
const problem = { id: "example", interview: definition.id };
const initial = () => startInterview(problem, { definition });

test("Send and Finish share a synchronous lock and finishing reads the latest conversation", async () => {
  const states = [];
  const session = new SessionOperations(initial(), (state) =>
    states.push(state),
  );
  const send = session.begin("send");
  assert.equal(session.begin("finish"), null);
  assert.equal(session.begin("send"), null);
  const candidate = acceptCandidateMessage(send.interview, "My answer");
  session.commit(send, candidate);
  await Promise.resolve();
  const answered = {
    ...candidate,
    messages: [
      ...candidate.messages,
      { role: "interviewer", content: "Follow-up" },
    ],
  };
  session.commit(send, answered);
  session.end(send);
  const finish = session.begin("finish");
  assert.deepEqual(finish.interview.messages, answered.messages);
  assert.equal(session.begin("send"), null);
  assert.equal(session.commit(send, candidate), false);
  session.end(send);
  assert.equal(session.begin("send"), null);
  session.commit(finish, { ...answered, status: "completed" });
  session.end(finish);
  assert.equal(session.begin("send"), null);
  assert.equal(session.begin("finish"), null);
  assert.equal(states.at(-1).interview.status, "completed");
});

test("failed and cancelled operations release the lock while late results cannot commit", async () => {
  let state;
  const session = new SessionOperations(initial(), (next) => {
    state = next;
  });
  const first = session.begin("send");
  const candidate = acceptCandidateMessage(
    first.interview,
    "Preserved on failure",
  );
  session.commit(first, candidate);
  session.end(first);
  const retry = session.begin("send");
  assert.deepEqual(retry.interview.messages, candidate.messages);
  session.cancel();
  assert.equal(retry.controller.signal.aborted, true);
  const current = session.begin("finish");
  await Promise.resolve();
  assert.equal(session.commit(retry, { ...candidate, messages: [] }), false);
  session.end(retry);
  assert.equal(state.operation, "finish");
  assert.equal(session.isCurrent(current), true);
  session.end(current);
});

test("shared workspace capture reads live code/diagrams and uses engine defaults", () => {
  let code;
  let diagram = { nodes: [], edges: [] };
  const readers = { code: () => code, diagram: () => diagram };
  assert.deepEqual(captureWorkspaceSnapshot("code", readers), {
    type: "code",
    language: "text",
    filename: "solution.txt",
    code: "",
  });
  code = { language: "Java", filename: "Solution.java", code: "first" };
  const sent = captureWorkspaceSnapshot("code", readers);
  code = { ...code, code: "edited" };
  assert.equal(sent.code, "first");
  assert.equal(captureWorkspaceSnapshot("code", readers).code, "edited");
  diagram = { nodes: [{ id: "db", type: "rectangle" }], edges: [] };
  assert.deepEqual(captureWorkspaceSnapshot("diagram", readers), {
    type: "diagram",
    diagram,
  });
  assert.deepEqual(captureWorkspaceSnapshot("project", readers), {
    type: "project",
    files: [],
  });
  assert.deepEqual(captureWorkspaceSnapshot("none", readers), { type: "none" });
});

// Execute entry points with their content/UI boundaries replaced, rather than
// asserting source text. No Next server or additional test dependencies needed.
function entryPoint(filename, overrides) {
  const source = readFileSync(
    new URL(`../../../${filename}`, import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const testModule = { exports: {} };
  const require = (name) =>
    overrides[name] ??
    (name.startsWith("@/") ? load(`../src/${name.slice(2)}`) : load(name));
  new Function("require", "module", "exports", outputText)(
    require,
    testModule,
    testModule.exports,
  );
  return testModule.exports;
}

function renderComponent(filename, name, overrides) {
  const slots = [];
  let index = 0;
  const react = {
    useEffect() {},
    useEffectEvent(callback) {
      return callback;
    },
    useSyncExternalStore(_subscribe, snapshot) {
      return snapshot();
    },
    useState(initialValue) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = initialValue;
      return [
        slots[slot],
        (value) => {
          slots[slot] = value;
        },
      ];
    },
    useRef(initialValue) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = { current: initialValue };
      return slots[slot];
    },
  };
  const component = entryPoint(filename, { ...overrides, react })[name];
  return () => {
    index = 0;
    return component();
  };
}

function element(tree, predicate) {
  if (!tree || typeof tree !== "object") return null;
  if (predicate(tree)) return tree;
  for (const child of [tree.props?.children].flat(Infinity)) {
    const found = element(child, predicate);
    if (found) return found;
  }
  return null;
}

test("Send retries reuse the captured workspace and Finish saves completion without evaluating", async () => {
  const { normalizeExcalidrawScene } = load(
    "../src/lib/diagram/normalize-excalidraw.ts",
  );
  const workspace = captureWorkspaceSnapshot("diagram", {
    code: () => undefined,
    diagram: () =>
      normalizeExcalidrawScene([
        {
          id: "service",
          type: "rectangle",
          x: 0,
          y: 0,
          width: 100,
          height: 80,
        },
        {
          id: "note",
          type: "text",
          text: "Retry with backoff",
          x: 0,
          y: 100,
          width: 150,
          height: 20,
        },
      ]),
  });
  let state = { interview: initial(), operation: null };
  const operations = new SessionOperations(state.interview, (next) => {
    state = next;
  });
  let releaseSend;
  let captures = 0;
  const snapshots = [];
  let navigated;
  let persistedSession;
  let providerIssue = "API key required.";
  const overrides = {
    "lucide-react": {
      Mic: "mic",
      MicOff: "mic-off",
      Volume2: "volume",
      VolumeX: "volume-off",
      Check: "check",
    },
    "./current-stage-badge": { CurrentStageBadge: "stage-badge" },
    "./recording-controls": { RecordingControls: "recording-controls" },
    "@/components/ui/spinner": { Spinner: "spinner" },
    "./interview-controls-context": {
      useInterviewControls: () => ({
        voiceEnabled: false,
        setVoiceEnabled: () => {},
        speechAvailable: false,
        playbackAvailable: false,
        elapsed: () => 60000,
      }),
    },
    "./use-interview-voice": {
      useInterviewVoice: () => ({
        recordingState: "idle",
        listening: false,
        error: "",
        stopPlayback: () => {},
        beginResponse: () => ({ push() {}, finish() {}, cancel() {} }),
        toggleMicrophone: () => {},
      }),
    },
    "@/components/ui/message-scroller": Object.fromEntries(
      [
        "MessageScrollerProvider",
        "MessageScroller",
        "MessageScrollerViewport",
        "MessageScrollerContent",
        "MessageScrollerItem",
        "MessageScrollerButton",
      ].map((name) => [name, name]),
    ),
    "@/components/ui/tooltip": {
      Tooltip: "tooltip",
      TooltipTrigger: "tooltip-trigger",
      TooltipContent: "tooltip-content",
    },
    "@/components/ui/button": { Button: "button" },
    "@/components/ui/empty": Object.fromEntries(
      [
        "Empty",
        "EmptyHeader",
        "EmptyTitle",
        "EmptyDescription",
        "EmptyContent",
      ].map((name) => [name, "div"]),
    ),
    "@/components/ui/alert-dialog": Object.fromEntries(
      [
        "AlertDialog",
        "AlertDialogTrigger",
        "AlertDialogContent",
        "AlertDialogHeader",
        "AlertDialogTitle",
        "AlertDialogDescription",
        "AlertDialogFooter",
        "AlertDialogCancel",
        "AlertDialogAction",
      ].map((name) => [name, name]),
    ),
    "@/components/ui/textarea": { Textarea: "textarea" },
    "@/components/settings-provider": { useOpenSettings: () => () => {} },
    "@/lib/settings/storage": {
      readSettings: () => ({ provider: "ollama", model: "local" }),
    },
    "@/lib/settings/types": { aiSettingsIssue: () => providerIssue },
    "@/components/interview-session-context": {
      useInterviewSession: () => ({
        ...state,
        problem,
        definition: { ...definition, workspace: "diagram" },
        beginOperation: operations.begin,
        commitOperation: operations.commit,
        endOperation: operations.end,
        isCurrentOperation: operations.isCurrent,
      }),
      useCaptureWorkspace: () => () => {
        captures++;
        return workspace;
      },
    },
    "@/lib/interview/engine": {
      acceptCandidateMessage,
      buildInterviewContext,
      completeInterview,
    },
    "@/lib/interview/runner": {
      processCandidateMessage: async (
        _settings,
        interview,
        _problem,
        _definition,
        snapshot,
      ) => {
        snapshots.push(snapshot);
        if (snapshots.length === 1)
          await new Promise((_resolve, reject) => {
            releaseSend = reject;
          });
        return interview;
      },
    },
    "@/lib/interview/session-storage": {
      readInterviewSession: () => persistedSession ?? null,
      saveInterviewSession: (value) => {
        persistedSession = value;
      },
    },
    "next/navigation": {
      useRouter: () => ({
        replace: (path) => {
          navigated = path;
        },
      }),
    },
  };
  const send = renderComponent(
    "src/components/ai-interviewer.tsx",
    "AIInterviewer",
    overrides,
  );
  const finish = renderComponent(
    "src/components/finish-interview-button.tsx",
    "FinishInterviewButton",
    overrides,
  );
  const configureButton = element(
    send(),
    (node) =>
      node.type === "button" && node.props.children === "Configure provider",
  );
  assert.ok(configureButton);
  assert.equal(configureButton.props.variant, undefined);
  providerIssue = "";
  assert.equal(
    element(send(), (node) => node.props.children === "Configure provider"),
    null,
  );
  element(send(), (node) => node.type === "textarea").props.onChange({
    target: { value: "Answer" },
  });
  element(send(), (node) => node.type === "form").props.onSubmit({
    preventDefault() {},
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state.operation, "send");
  const finishButton = element(
    finish(),
    (node) => node.type === "AlertDialogTrigger",
  );
  assert.equal(finishButton.props.disabled, true);
  element(
    finish(),
    (node) => node.type === "AlertDialogAction",
  ).props.onClick();
  assert.equal(persistedSession, undefined);
  releaseSend(Error("temporary failure"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state.operation, null);
  const retry = element(
    send(),
    (node) => node.type === "button" && node.props.children === "Retry",
  );
  await retry.props.onClick();
  assert.equal(captures, 1);
  assert.equal(snapshots[1], snapshots[0]);
  assert.equal(state.interview.messages.length, 1);
  element(
    finish(),
    (node) => node.type === "AlertDialogAction",
  ).props.onClick();
  assert.equal(state.interview.status, "completed");
  assert.equal(persistedSession.interview.status, "completed");
  assert.equal(captures, 2);
  assert.deepEqual(snapshots[0], workspace);
  assert.deepEqual(persistedSession.evaluationWorkspace, workspace);
  assert.equal(state.interview.status, "completed");
  assert.equal(navigated, `/interviews/${state.interview.id}/result`);
});

test("page and API start restricted definitions; unsupported explicit API options return 400", async () => {
  const restricted = {
    ...definition,
    defaultLevel: "junior",
    levels: [{ id: "junior", name: "Junior" }],
    defaultMode: "mock",
    modes: ["mock"],
  };
  const overrides = {
    "@/lib/problems/loader": { getProblem: async () => problem },
    "@/lib/interview/definitions": {
      requireInterviewDefinition: async () => restricted,
    },
    "@/components/interview-setup": { InterviewSetup: () => null },
    "next/navigation": {
      notFound: () => {
        throw Error("not found");
      },
    },
  };
  const page = entryPoint("src/app/practice/[id]/setup/page.tsx", overrides);
  const rendered = await page.default({
    params: Promise.resolve({ id: problem.id }),
  });
  assert.equal(rendered.props.definition, restricted);
  assert.equal(rendered.props.interview, undefined);
  const restrictedInterview = startInterview(problem, {
    definition: restricted,
  });
  assert.equal(restrictedInterview.targetLevel, "junior");
  assert.equal(restrictedInterview.mode, "mock");
  const { POST } = entryPoint("src/app/api/interview/route.ts", overrides);
  const post = (options) =>
    POST(
      new Request("http://localhost/api/interview", {
        method: "POST",
        body: JSON.stringify({ problemId: problem.id, ...options }),
      }),
    );
  const response = await post({});
  assert.equal(response.status, 201);
  const started = await response.json();
  assert.equal(started.targetLevel, "junior");
  assert.equal(started.mode, "mock");
  for (const options of [{ targetLevel: "senior" }, { mode: "practice" }]) {
    const invalid = await post(options);
    assert.equal(invalid.status, 400);
    assert.match((await invalid.json()).error, /Unsupported/);
  }
  assert.equal(
    (await post({ targetLevel: "junior", mode: "mock" })).status,
    201,
  );
  assert.equal(initial().targetLevel, "senior");
  assert.equal(initial().mode, "practice");
});

test("domain result schema reads existing JSON and one storage supports writes and stable snapshots", () => {
  globalThis.window = { sessionStorage: storage() };
  try {
    const adapter = new LocalStorage("sessionStorage");
    const result = {
      interviewId: "legacy",
      problemId: "example",
      definition: { id: "behavioral", version: 1, revision: "original" },
      targetLevel: "senior",
      recommendation: "mixed",
      competencies: [],
      strengths: [],
      concerns: [],
      keyMoments: [],
      summary: "Summary",
      finalAssessment: "Assessment",
      createdAt: "2026-10-01T12:00:00.000Z",
    };
    window.sessionStorage.setItem(
      "openmock:interview-result:v3:legacy",
      JSON.stringify(result),
    );
    const existing = readEvaluationValue("legacy", adapter);
    assert.deepEqual(parseEvaluation(existing), result);
    saveEvaluation(result, adapter);
    assert.equal(readEvaluationValue("legacy", adapter), existing);
    assert.deepEqual(
      adapter.get("openmock:interview-result:v3:legacy"),
      result,
    );
    assert.equal(parseEvaluation('{"interviewId":"legacy"}'), null);
    adapter.setText("raw", 'secret"value');
    assert.equal(adapter.getText("raw"), 'secret"value');
    assert.equal(window.sessionStorage.getItem("raw"), 'secret"value');
    adapter.remove("raw");
    assert.equal(adapter.getText("raw"), null);
  } finally {
    delete globalThis.window;
  }
});

const { resolveInterviewDuration } = load("../src/lib/interview/duration.ts");

test("duration resolves override or definition default and active interviews retain their captured value", () => {
  assert.equal(
    resolveInterviewDuration(problem, definition),
    definition.duration.defaultMinutes,
  );
  const overridden = { ...problem, duration: { minutes: 17 } };
  const started = startInterview(overridden, { definition });
  assert.equal(started.durationMinutes, 17);
  assert.equal(started.timer.runningSince, Date.parse(started.startedAt));
  assert.equal(
    resolveInterviewDuration(
      { ...overridden, duration: { minutes: 25 } },
      definition,
      started.durationMinutes,
    ),
    17,
  );
});

test("one session timer survives checkpoints, running recovery, paused recovery, and completion", () => {
  let now = 1000,
    saved;
  const started = { ...initial(), timer: { elapsedMs: 0, runningSince: now } };
  const persist = (state) => {
    saved = JSON.parse(JSON.stringify(state.interview));
  };
  const session = new SessionOperations(started, persist, () => now);
  assert.equal(session.isPaused(), false);
  now += 2000;
  session.checkpoint();
  session.checkpoint();
  assert.equal(session.elapsed(), 2000);
  now += 3000;
  const recovered = new SessionOperations(saved, persist, () => now);
  assert.equal(recovered.elapsed(), 5000);
  recovered.toggleTimer();
  assert.equal(recovered.isPaused(), true);
  now += 90000;
  const paused = new SessionOperations(saved, persist, () => now);
  assert.equal(paused.isPaused(), true);
  assert.equal(paused.elapsed(), 5000);
  paused.toggleTimer();
  now += 1000;
  const request = paused.begin("finish");
  assert.equal(request.interview.elapsedMs, 6000);
  paused.commit(request, { ...request.interview, status: "completed" });
  paused.end(request);
  now += 10000;
  assert.equal(paused.elapsed(), 6000);
  assert.equal(saved.timer.runningSince, null);
});
