import { test } from "node:test";
import assert from "node:assert/strict";
import { load, storage } from "../../register-typescript.mjs";

const { parseEvaluation, readEvaluationValue, saveEvaluation } = load("../src/lib/interview/evaluation-storage.ts");

test("updated InterviewResult serializes and supports not-assessed", () => {
  globalThis.sessionStorage = storage();
  const result = {
    interviewId: "interview-1", problemId: "two-sum",
    definition: { id: "dsa", version: 1, revision: "builtin-dsa-v1" }, targetLevel: "senior",
    recommendation: "mixed",
    competencies: [{ competencyId: "trade-offs", rating: "not-assessed", summary: "No trade-off discussion occurred.", evidence: [] }],
    strengths: [], concerns: [], keyMoments: [], summary: "Limited evidence.",
    finalAssessment: "More conversation is needed for a confident assessment.", createdAt: "2026-09-30T12:00:00.000Z",
  };
  saveEvaluation(result);
  const serialized = readEvaluationValue(result.interviewId);
  assert.deepEqual(parseEvaluation(serialized), result);
  assert.ok(!serialized.includes("apiKey"));
  delete globalThis.sessionStorage;
});
