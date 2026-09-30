import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../../tests/register-typescript.mjs";
import { loadDefinition } from "../../../tests/content-fixtures.mjs";

const evaluation = load("../src/lib/ai/evaluation.ts");
const { finishInterview, startInterview } = load("../src/lib/interview/engine.ts");

const problem = { id: "two-sum", title: "Two Sum", interview: "dsa", complexity: "low", categories: [], topics: [], companies: [], tags: [], content: "Find indices.", language: "java", starterCode: "class Solution {}" };
const definition = loadDefinition("dsa");

test("finishInterview returns evaluation without persisting it", async () => {
  const interview = startInterview(problem, { definition, targetLevel: "senior", mode: "practice" });
  const result = {
    interviewId: interview.id, problemId: problem.id, definition: interview.definition, targetLevel: "senior", recommendation: "mixed",
    competencies: [], strengths: [], concerns: [], keyMoments: [], summary: "Summary", finalAssessment: "Assessment", createdAt: new Date().toISOString(),
  };
  evaluation.evaluateInterview = async () => result;
  globalThis.sessionStorage = { setItem() { throw new Error("engine attempted persistence"); } };
  const finished = await finishInterview({}, interview, problem, definition, { type: "code", language: "Java", filename: "Solution.java", code: "" });
  assert.equal(finished.evaluation, result);
  assert.equal(finished.interview.status, "completed");
  delete globalThis.sessionStorage;
});
