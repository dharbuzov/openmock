import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../register-typescript.mjs";
import { loadDefinition } from "../../content-fixtures.mjs";

const evaluation = load("../src/lib/ai/evaluation.ts");
const { startInterview } = load("../src/lib/interview/engine.ts");
const { finishInterview } = load("../src/lib/interview/runner.ts");

const problem = {
  id: "two-sum",
  title: "Two Sum",
  interview: "dsa",
  difficulty: "easy",
  categories: [],
  topics: [],
  companies: [],

  content: "Find indices.",
  language: "java",
  starterCode: "class Solution {}",
};
const definition = loadDefinition("dsa");

test("finishInterview returns evaluation without persisting it", async () => {
  const interview = startInterview(problem, {
    definition,
    targetLevel: "senior",
    mode: "practice",
  });
  const result = {
    interviewId: interview.id,
    problemId: problem.id,
    definition: interview.definition,
    targetLevel: "senior",
    recommendation: "mixed",
    competencies: [],
    strengths: [],
    concerns: [],
    keyMoments: [],
    summary: "Summary",
    finalAssessment: "Assessment",
    createdAt: new Date().toISOString(),
  };
  const original = evaluation.evaluateInterview;
  evaluation.evaluateInterview = async () => result;
  globalThis.sessionStorage = {
    setItem() {
      throw new Error("engine attempted persistence");
    },
  };
  try {
    const finished = await finishInterview({}, interview, problem, definition, {
      type: "code",
      language: "Java",
      filename: "Solution.java",
      code: "",
    });
    assert.equal(finished.evaluation.status, "completed");
    assert.equal(finished.evaluation.result, result);
    assert.equal(finished.interview.status, "completed");
  } finally {
    evaluation.evaluateInterview = original;
    delete globalThis.sessionStorage;
  }
});
