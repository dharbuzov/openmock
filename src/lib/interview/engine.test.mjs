import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../../tests/register-typescript.mjs";
import { loadDefinition } from "../../../tests/content-fixtures.mjs";

const { acceptCandidateMessage, applyInterviewTurn, startInterview } = load("../src/lib/interview/engine.ts");

const problem = { id: "url-shortener", title: "URL Shortener", interview: "system-design", complexity: "low", categories: [], topics: [], companies: [], tags: [], content: "Design a shortener." };
const definition = loadDefinition("system-design");
const start = () => startInterview(problem, { definition, targetLevel: "senior", mode: "practice" });
const turn = (overrides = {}) => ({ message: "Continue.", stageComplete: false, observations: [], ...overrides });

test("model output cannot jump to an arbitrary stage", () => {
  const interview = start();
  const updated = applyInterviewTurn(interview, definition, { ...turn(), stage: "wrap-up" });
  assert.equal(updated.stage.current, "requirements");
  assert.equal(updated.messages[0].stage, "requirements");
});

test("stageComplete false keeps the current stage", () => {
  const updated = applyInterviewTurn(start(), definition, turn());
  assert.equal(updated.stage.current, "requirements");
  assert.deepEqual(updated.stage.completed, []);
});

test("stageComplete true advances exactly one definition stage", () => {
  const updated = applyInterviewTurn(start(), definition, turn({ stageComplete: true }));
  assert.equal(updated.stage.current, "high-level-design");
  assert.deepEqual(updated.stage.completed, ["requirements"]);
});

test("completed stages are recorded once", () => {
  const interview = { ...start(), stage: { current: "requirements", completed: ["requirements"], startedAt: new Date().toISOString() } };
  const updated = applyInterviewTurn(interview, definition, turn({ stageComplete: true }));
  assert.deepEqual(updated.stage.completed, ["requirements"]);
});

test("completing the final stage keeps a valid final-stage state", () => {
  const interview = { ...start(), stage: { current: "wrap-up", completed: definition.stages.slice(0, -1).map(({ id }) => id), startedAt: new Date().toISOString() } };
  const updated = applyInterviewTurn(interview, definition, turn({ stageComplete: true }));
  assert.equal(updated.stage.current, "wrap-up");
  assert.deepEqual(updated.stage.completed, definition.stages.map(({ id }) => id));
  assert.equal(updated.status, "in-progress");
});

test("observation stage is assigned from the engine's current stage", () => {
  const interview = acceptCandidateMessage(start(), "Availability matters.");
  const updated = applyInterviewTurn(interview, definition, turn({
    observations: [{ id: "obs-1", competencyId: "requirements-scope", observation: "Candidate prioritized availability.", messageId: interview.messages[0].id, stage: "wrap-up" }],
  }));
  assert.equal(updated.observations[0].stage, "requirements");
});
