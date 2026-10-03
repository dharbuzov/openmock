import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../register-typescript.mjs";
import { loadDefinition } from "../../content-fixtures.mjs";

const {
  acceptCandidateMessage,
  applyInterviewTurn,
  startInterview,
  completeInterview,
  InterviewStateError,
} = load("../src/lib/interview/engine.ts");

const problem = {
  id: "url-shortener",
  title: "URL Shortener",
  interview: "system-design",
  difficulty: "easy",
  categories: [],
  topics: [],
  companies: [],

  content: "Design a shortener.",
};
const definition = loadDefinition("system-design");
const start = () =>
  startInterview(problem, {
    definition,
    targetLevel: "senior",
    mode: "practice",
  });
const turn = (overrides = {}) => ({
  message: "Continue.",
  stageComplete: false,
  observations: [],
  ...overrides,
});

test("model output cannot jump to an arbitrary stage", () => {
  const interview = start();
  const updated = applyInterviewTurn(interview, definition, {
    ...turn(),
    stage: "wrap-up",
  });
  assert.equal(updated.stage.current, "requirements");
  assert.equal(updated.messages[0].stage, "requirements");
});

test("stageComplete false keeps the current stage", () => {
  const updated = applyInterviewTurn(start(), definition, turn());
  assert.equal(updated.stage.current, "requirements");
  assert.deepEqual(updated.stage.completed, []);
});

test("stageComplete true advances exactly one definition stage", () => {
  const updated = applyInterviewTurn(
    start(),
    definition,
    turn({ stageComplete: true }),
  );
  assert.equal(updated.stage.current, "high-level-design");
  assert.deepEqual(updated.stage.completed, ["requirements"]);
});

test("completed stages are recorded once", () => {
  const interview = {
    ...start(),
    stage: {
      current: "requirements",
      completed: ["requirements"],
      startedAt: new Date().toISOString(),
    },
  };
  const updated = applyInterviewTurn(
    interview,
    definition,
    turn({ stageComplete: true }),
  );
  assert.deepEqual(updated.stage.completed, ["requirements"]);
});

test("completing the final stage clears the active stage", () => {
  const interview = {
    ...start(),
    stage: {
      current: "wrap-up",
      completed: definition.stages.slice(0, -1).map(({ id }) => id),
      startedAt: new Date().toISOString(),
    },
  };
  const updated = applyInterviewTurn(
    interview,
    definition,
    turn({ stageComplete: true }),
  );
  assert.equal(updated.stage.current, null);
  assert.deepEqual(
    updated.stage.completed,
    definition.stages.map(({ id }) => id),
  );
  assert.equal(updated.status, "in-progress");
});

test("observation stage is assigned from the engine's current stage", () => {
  const interview = acceptCandidateMessage(start(), "Availability matters.");
  const updated = applyInterviewTurn(
    interview,
    definition,
    turn({
      observations: [
        {
          id: "obs-1",
          competencyId: "requirements-scope",
          observation: "Candidate prioritized availability.",
          messageId: interview.messages[0].id,
          stage: "wrap-up",
        },
      ],
    }),
  );
  assert.equal(updated.observations[0].stage, "requirements");
});

test("defaults come exclusively from the definition", () => {
  const changed = {
    ...definition,
    defaultLevel: "principal",
    defaultMode: "mock",
  };
  const interview = startInterview(problem, { definition: changed });
  assert.equal(interview.targetLevel, "principal");
  assert.equal(interview.mode, "mock");
  const another = startInterview(problem, {
    definition: { ...changed, defaultLevel: "middle", defaultMode: "practice" },
  });
  assert.equal(another.targetLevel, "middle");
  assert.equal(another.mode, "practice");
});

test("terminal and unknown stages reject further turns", () => {
  for (const current of [null, "unknown"]) {
    const interview = { ...start(), stage: { ...start().stage, current } };
    assert.throws(
      () => applyInterviewTurn(interview, definition, turn()),
      InterviewStateError,
    );
  }
  const terminal = { ...start(), stage: { ...start().stage, current: null } };
  assert.throws(
    () => acceptCandidateMessage(terminal, "Another answer"),
    /No active/,
  );
});

test("completion is an independent domain transition and cannot happen twice", () => {
  const initial = start();
  const completed = completeInterview(initial);
  assert.equal(initial.status, "in-progress");
  assert.equal(completed.status, "completed");
  assert.equal(completed.stage.current, null);
  assert.equal(completed.endReason, "candidate-finished");
  assert.ok(Number.isFinite(Date.parse(completed.completedAt)));
  assert.throws(() => completeInterview(completed), InterviewStateError);
  assert.throws(
    () => applyInterviewTurn(completed, definition, turn()),
    InterviewStateError,
  );
});

test("selected session choices override definition defaults for the same problem", () => {
  const defaults = startInterview(problem, { definition });
  const selected = startInterview(problem, {
    definition,
    targetLevel: "principal",
    mode: "mock",
  });
  assert.equal(defaults.targetLevel, definition.defaultLevel);
  assert.equal(defaults.mode, definition.defaultMode);
  assert.equal(selected.targetLevel, "principal");
  assert.equal(selected.mode, "mock");
  assert.equal(selected.problemId, defaults.problemId);
});
