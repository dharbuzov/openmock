import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "../../register-typescript.mjs";
import { loadDefinition } from "../../content-fixtures.mjs";

const engine = load("../src/lib/interview/engine.ts");
const runner = load("../src/lib/interview/runner.ts");
const provider = load("../src/lib/ai/provider.ts");
const { SessionOperations } = load(
  "../src/lib/interview/session-operations.ts",
);
const { interviewContext, interviewerSystemPrompt } = load(
  "../src/lib/ai/prompts.ts",
);
const turn = (stageComplete = false) => ({
  message: "A challenging follow-up?",
  stageComplete,
  observations: [],
});
function fixture(id = "system-design", minutes = 20) {
  const definition = loadDefinition(id);
  const problem = { id: "example", interview: id, duration: { minutes } };
  const interview = engine.startInterview(problem, {
    definition,
    targetLevel: "principal",
  });
  return { definition, problem, interview };
}
const opening = (interview, definition) =>
  engine.applyInterviewTurn(interview, definition, turn());
const answer = (interview) =>
  engine.acceptCandidateMessage(interview, "Here is my reasoning.");

for (const minutes of [20, 30, 45, 60]) {
  test(`${minutes}-minute interviews bound repeated false recommendations and reserve later stages`, () => {
    const { definition, interview } = fixture("system-design", minutes);
    let state = opening(interview, definition);
    let transition;
    for (let elapsedMinutes = 1; elapsedMinutes <= minutes; elapsedMinutes++) {
      const incoming = answer({ ...state, elapsedMs: elapsedMinutes * 60_000 });
      const plan = engine.planInterviewTurn(incoming, definition);
      if (plan.transition) {
        transition = plan;
        break;
      }
      state = engine.applyInterviewTurn(plan.interview, definition, turn());
    }
    assert.ok(["time", "follow-ups"].includes(transition.transition.reason));
    assert.equal(transition.interview.stage.current, "high-level-design");
    assert.ok(
      transition.interview.elapsedMs <= (minutes * 60_000) / 4 + 60_000,
    );
    const timing = engine.interviewTiming(transition.interview, definition);
    assert.equal(timing.stageElapsedMs, 0);
    assert.ok(timing.allowanceMs > 0);
    assert.ok(timing.remainingMs >= (minutes * 60_000) / 2);
  });
}

test("early semantic readiness redistributes unused time but never changes the current response's stage", () => {
  const { definition, interview } = fixture();
  const ready = engine.applyInterviewTurn(
    answer(opening(interview, definition)),
    definition,
    turn(true),
  );
  assert.equal(ready.stage.current, "requirements");
  assert.equal(ready.messages.at(-1).stage, "requirements");
  const plan = engine.planInterviewTurn(
    answer({ ...ready, elapsedMs: 60_000 }),
    definition,
  );
  assert.deepEqual(plan.transition, {
    from: "requirements",
    to: "high-level-design",
    reason: "ready",
  });
  assert.equal(plan.interview.stage.allowanceMs, (19 * 60_000) / 5);
  assert.equal(ready.stage.current, "requirements");
});

test("valuable discussions can exceed the soft allowance but not the bounded extension", () => {
  const { definition, interview } = fixture();
  const state = opening(interview, definition);
  const soft = interview.stage.allowanceMs;
  assert.equal(
    engine.planInterviewTurn(
      answer({ ...state, elapsedMs: soft * 1.2 }),
      definition,
    ).transition,
    undefined,
  );
  assert.equal(
    engine.planInterviewTurn(
      answer({ ...state, elapsedMs: soft * 1.5 }),
      definition,
    ).transition.reason,
    "time",
  );
});

test("rapid follow-up loops are bounded by successful exchanges even with little elapsed time", () => {
  const { definition, interview } = fixture();
  let state = opening(interview, definition);
  for (let i = 0; i < 7; i++) {
    const plan = engine.planInterviewTurn(
      answer({ ...state, elapsedMs: 1000 }),
      definition,
    );
    assert.equal(plan.transition, undefined);
    state = engine.applyInterviewTurn(plan.interview, definition, turn());
  }
  assert.equal(
    engine.planInterviewTurn(answer(state), definition).transition.reason,
    "follow-ups",
  );
});

test("even overdue stages get a question and candidate opportunity before moving on", () => {
  const { definition, interview } = fixture();
  const plan = engine.planInterviewTurn(
    answer({ ...opening(interview, definition), elapsedMs: 21 * 60_000 }),
    definition,
  );
  const entered = engine.applyInterviewTurn(plan.interview, definition, turn());
  assert.equal(entered.stage.current, "high-level-design");
  assert.equal(
    engine.planInterviewTurn(entered, definition).transition,
    undefined,
  );
  // Only the next submitted candidate response creates another boundary.
  const next = engine.planInterviewTurn(answer(entered), definition);
  assert.equal(next.interview.stage.current, "deep-dive");
  assert.deepEqual(next.interview.stage.completed, [
    "requirements",
    "high-level-design",
  ]);
});

test("stage pacing uses active time across pause, resume, and restored sessions", () => {
  const { definition, interview } = fixture();
  let now = Date.parse(interview.startedAt),
    state;
  const session = new SessionOperations(
    opening(interview, definition),
    (next) => {
      state = next;
    },
    () => now,
  );
  now += 2 * 60_000;
  session.toggleTimer();
  now += 30 * 60_000;
  const paused = session.begin("send");
  let plan = engine.planInterviewTurn(answer(paused.interview), definition);
  assert.equal(
    engine.interviewTiming(plan.interview, definition).stageElapsedMs,
    2 * 60_000,
  );
  assert.equal(plan.transition, undefined);
  session.end(paused);
  const restored = new SessionOperations(
    state.interview,
    (next) => {
      state = next;
    },
    () => now,
  );
  restored.toggleTimer();
  now += 3 * 60_000;
  const resumed = restored.begin("send");
  plan = engine.planInterviewTurn(answer(resumed.interview), definition);
  assert.equal(plan.transition.reason, "time");
  assert.equal(plan.interview.stage.startedElapsedMs, 5 * 60_000);
  restored.end(resumed);
});

test("legacy sessions and custom Markdown definitions use the same generic policy", () => {
  const { parseInterviewDefinitionDocument } = load(
    "../src/lib/interview/definition-schema.ts",
  );
  const source = readFileSync("content/interviews/dsa.md", "utf8")
    .replace("id: dsa", "id: sql")
    .replace("name: Data Structures and Algorithms", "name: SQL")
    .replace("  - approach", "  - clarify")
    .replace("  - implementation", "  - query");
  const definition = parseInterviewDefinitionDocument(source);
  let interview = engine.startInterview(
    { id: "query", interview: "sql" },
    { definition },
  );
  const { startedElapsedMs, allowanceMs, readyToAdvance, ...legacyStage } =
    interview.stage;
  interview = opening(
    { ...interview, stage: legacyStage, elapsedMs: 0 },
    definition,
  );
  const plan = engine.planInterviewTurn(answer(interview), definition);
  assert.equal(plan.interview.stage.current, "clarify");
  assert.ok(Number.isFinite(plan.interview.stage.startedElapsedMs));
  assert.ok(plan.interview.stage.allowanceMs > 0);
  for (const id of ["dsa", "behavioral", "system-design"]) {
    const f = fixture(id);
    const ready = engine.applyInterviewTurn(
      opening(f.interview, f.definition),
      f.definition,
      turn(true),
    );
    assert.equal(
      engine.planInterviewTurn(answer(ready), f.definition).interview.stage
        .current,
      f.definition.stages[1].id,
    );
  }
});

test("transition response uses destination context, preserves source evidence, and retries atomically", async () => {
  const { definition, problem, interview } = fixture();
  const incoming = answer({
    ...opening(interview, definition),
    elapsedMs: 5 * 60_000,
  });
  const original = provider.generateInterviewResponse;
  let fail = true,
    calls = 0;
  const previews = [];
  provider.generateInterviewResponse = async (
    _settings,
    context,
    _signal,
    onMessage,
  ) => {
    calls++;
    assert.equal(context.interview.stage.current, "high-level-design");
    assert.equal(context.transition.from, "requirements");
    assert.match(
      context.definition.instructions,
      /draw their proposed[\s\S]*architecture/,
    );
    assert.equal(context.interview.messages.at(-1).stage, "requirements");
    if (fail) throw new Error("offline");
    const message =
      "We've clarified the scope. Let's move to High-Level Design. Please draw your architecture and walk me through the request flow.";
    onMessage?.(message);
    return {
      ...turn(),
      message,
      observations: [
        {
          id: "",
          observation: "Candidate explained constraints.",
          messageId: incoming.messages.at(-1).id,
        },
      ],
    };
  };
  const run = () =>
    runner.processCandidateMessage(
      {},
      incoming,
      problem,
      definition,
      undefined,
      undefined,
      undefined,
      false,
      undefined,
      (stage) => previews.push(stage),
    );
  try {
    await assert.rejects(run(), /offline/);
    assert.equal(incoming.stage.current, "requirements");
    assert.deepEqual(incoming.stage.completed, []);
    fail = false;
    const result = await run();
    assert.equal(calls, 2);
    assert.deepEqual(previews, ["high-level-design", "high-level-design"]);
    assert.equal(result.stage.current, "high-level-design");
    assert.deepEqual(result.stage.completed, ["requirements"]);
    assert.equal(result.messages.length, incoming.messages.length + 1);
    assert.equal(result.messages.at(-1).stage, result.stage.current);
    assert.match(
      result.messages.at(-1).content,
      /move to High-Level Design.*draw/,
    );
    assert.equal(result.observations[0].stage, "requirements");
  } finally {
    provider.generateInterviewResponse = original;
  }
});

test("stage preview synchronizes pending badges without saving a failed transition", () => {
  const { interview } = fixture();
  let state;
  const session = new SessionOperations(interview, (next) => {
    state = next;
  });
  const request = session.begin("send");
  session.previewStage(request, "high-level-design");
  assert.equal(state.responseStage, "high-level-design");
  assert.equal(state.interview.stage.current, "requirements");
  session.end(request);
  assert.equal(state.responseStage, undefined);
  session.previewStage(request, "deep-dive");
  assert.equal(state.responseStage, undefined);
});

test("aborted generation cannot commit a planned transition even if the provider returns a response", async () => {
  const { definition, problem, interview } = fixture();
  const incoming = answer({
    ...opening(interview, definition),
    elapsedMs: 5 * 60_000,
  });
  const controller = new AbortController();
  const original = provider.generateInterviewResponse;
  provider.generateInterviewResponse = async () => {
    controller.abort();
    return turn();
  };
  try {
    await assert.rejects(
      runner.processCandidateMessage(
        {},
        incoming,
        problem,
        definition,
        undefined,
        controller.signal,
      ),
      { name: "AbortError" },
    );
    assert.equal(incoming.stage.current, "requirements");
    assert.deepEqual(incoming.stage.completed, []);
  } finally {
    provider.generateInterviewResponse = original;
  }
});

test("a stage entry cannot recommend completion before its candidate activity", async () => {
  const { definition, problem, interview } = fixture("dsa");
  const ready = engine.applyInterviewTurn(
    opening(interview, definition),
    definition,
    turn(true),
  );
  const incoming = answer({ ...ready, elapsedMs: 60_000 });
  const original = provider.generateInterviewResponse;
  provider.generateInterviewResponse = async (_settings, context) => {
    assert.equal(context.interview.stage.current, "implementation");
    return {
      ...turn(true),
      message:
        "Let's move to Implementation. Please write your solution and explain it as you work.",
    };
  };
  try {
    const result = await runner.processCandidateMessage(
      {},
      incoming,
      problem,
      definition,
    );
    assert.equal(result.stage.readyToAdvance, false);
    assert.equal(
      engine.planInterviewTurn(answer(result), definition).transition,
      undefined,
    );
  } finally {
    provider.generateInterviewResponse = original;
  }
});

test("final-stage closure is planned before its response and does not skip unfinished stages", () => {
  const { definition, interview } = fixture();
  const current = definition.stages.at(-1).id;
  const state = engine.applyInterviewTurn(
    {
      ...interview,
      elapsedMs: 19 * 60_000,
      stage: {
        ...interview.stage,
        current,
        completed: definition.stages.slice(0, -1).map(({ id }) => id),
        startedElapsedMs: 18 * 60_000,
        allowanceMs: 2 * 60_000,
      },
    },
    definition,
    turn(true),
  );
  const plan = engine.planInterviewTurn(answer(state), definition);
  assert.equal(plan.transition.to, null);
  assert.equal(plan.interview.stage.current, current);
  const closed = engine.applyInterviewTurn(
    plan.interview,
    definition,
    {
      ...turn(),
      message:
        "The discussion is complete. Finish the interview to receive feedback.",
    },
    plan.transition,
  );
  assert.equal(closed.stage.current, null);
  assert.equal(closed.messages.at(-1).stage, current);
  assert.equal(closed.stage.completed.length, definition.stages.length);
  assert.throws(
    () =>
      engine.applyInterviewTurn(interview, definition, turn(), {
        from: "requirements",
        to: null,
        reason: "time",
      }),
    /Only the final stage/,
  );
});

test("runtime context and Markdown instructions expose pacing, activities, openings, and cross-stage evidence", async () => {
  const { definition, problem, interview } = fixture();
  const context = engine.buildInterviewContext(
    { ...interview, elapsedMs: 90_000 },
    problem,
    definition,
  );
  const data = JSON.parse(interviewContext(context));
  assert.equal(data.time.totalMinutes, 20);
  assert.equal(data.time.elapsedMinutes, 1.5);
  assert.equal(data.time.remainingMinutes, 18.5);
  assert.equal(data.time.stageElapsedMinutes, 1.5);
  assert.equal(data.stagePosition, 1);
  assert.equal(data.totalStageCount, 6);
  assert.equal(data.remainingStages[0].id, "high-level-design");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(readFileSync("content/prompts/interviewer.md", "utf8"));
  try {
    const prompt = await interviewerSystemPrompt(context);
    assert.match(prompt, /Briefly introduce[\s\S]*supplied problem/);
    assert.match(prompt, /clarification questions/);
    assert.match(
      prompt,
      /explicitly introduce the destination stage naturally by name/,
    );
    assert.match(prompt, /including its entry[\s\S]*activity/);
    assert.match(prompt, /10–15%/);
    assert.match(
      loadDefinition("dsa").instructions,
      /dedicated[\s\S]*coding time/,
    );
    const evaluator = readFileSync("content/prompts/evaluator.md", "utf8");
    assert.match(evaluator, /Competency evidence can come from any stage/);
    assert.match(
      evaluator,
      /completed[\s\S]*stage is a scheduling fact, not proof of competence/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
