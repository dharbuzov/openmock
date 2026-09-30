import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../register-typescript.mjs";
import { loadDefinition } from "../../content-fixtures.mjs";

const { applyInterviewTurn, buildInterviewContext, emptyWorkspaceSnapshot, startInterview } = load("../src/lib/interview/engine.ts");

const problem = { id: "url-shortener", title: "URL Shortener", interview: "system-design", complexity: "low", categories: [], topics: [], companies: [], tags: [], content: "Design a shortener." };
const definition = loadDefinition("system-design");
const start = () => startInterview(problem, { definition, targetLevel: "senior", mode: "practice" });

test("workspace snapshots form a capability union and reject mismatches", () => {
  assert.deepEqual(emptyWorkspaceSnapshot("diagram"), { type: "diagram", diagram: { nodes: [], edges: [] } });
  assert.deepEqual(emptyWorkspaceSnapshot("code"), { type: "code", language: "text", filename: "solution.txt", code: "" });
  assert.deepEqual(emptyWorkspaceSnapshot("project"), { type: "project", files: [] });
  assert.deepEqual(emptyWorkspaceSnapshot("none"), { type: "none" });
  assert.throws(() => buildInterviewContext(start(), problem, definition, { type: "none" }), /does not match/);
});

test("unsupported target levels and modes are rejected", () => {
  const restricted = { ...definition, levels: [{ id: "senior", name: "Senior" }], modes: ["mock"] };
  assert.throws(() => startInterview(problem, { definition: restricted, targetLevel: "staff", mode: "mock" }), /target level/);
  assert.throws(() => startInterview(problem, { definition: restricted, targetLevel: "senior", mode: "practice" }), /interview mode/);
});

test("definition id, version, and revision must match the started interview", () => {
  const interview = start();
  for (const changed of [
    { ...definition, id: "changed" },
    { ...definition, version: definition.version + 1 },
    { ...definition, revision: "changed" },
  ]) assert.throws(() => buildInterviewContext(interview, problem, changed), /definition does not match/);
});

test("unknown competency IDs are rejected instead of erased", () => {
  assert.throws(() => applyInterviewTurn(start(), definition, {
    message: "Continue.", stageComplete: false,
    observations: [{ id: "obs-1", competencyId: "leadership", observation: "Invalid competency." }],
  }), /Unknown competency: leadership/);
});
