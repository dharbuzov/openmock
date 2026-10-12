import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "../../register-typescript.mjs";
import { loadDefinition } from "../../content-fixtures.mjs";

const { startInterview, acceptCandidateMessage, buildInterviewContext } = load(
  "../src/lib/interview/engine.ts",
);
const { validateResult, IncompleteEvaluationError } = load(
  "../src/lib/ai/evaluation.ts",
);
function fixture() {
  const definition = loadDefinition("dsa");
  const problem = { id: "two-sum", interview: "dsa", difficulty: "easy" };
  const interview = acceptCandidateMessage(
    startInterview(problem, { definition, targetLevel: "principal" }),
    "A single-pass map solves this in O(n) expected time and O(n) space.",
  );
  const context = buildInterviewContext(interview, problem, definition);
  const result = {
    recommendation: "mixed",
    competencies: definition.evaluation.competencies.map(({ id }) => ({
      competencyId: id,
      rating: "positive",
      summary: "Demonstrated against the level definition.",
      evidence: [
        {
          observation: "Candidate explained reasoning.",
          messageId: interview.messages[0].id,
        },
      ],
    })),
    strengths: [],
    concerns: [],
    keyMoments: [],
    summary: "A correct solution was discussed.",
    finalAssessment: "The evidence is limited for this level.",
  };
  return { context, result };
}
test("correct easy solution at Principal cannot support Strong Hire with missing required depth evidence", () => {
  const { context, result } = fixture();
  const depth = result.competencies.find(
    ({ competencyId }) => competencyId === "technical-depth",
  );
  Object.assign(depth, {
    rating: "not-assessed",
    evidence: [],
    summary: "The interview offered no meaningful depth assessment.",
  });
  assert.doesNotThrow(() => validateResult(result, context));
  assert.throws(
    () => validateResult({ ...result, recommendation: "strong-hire" }, context),
    /Strong Hire/,
  );
});
test("substantial level-specific evidence permits Strong Hire regardless of easy problem label", () => {
  const { context, result } = fixture();
  context.interview.messages[0].content =
    "Compared failure modes and worst-case assumptions, justified resource trade-offs and correctness invariants, and adapted the design to changed constraints with independent reasoning.";
  for (const competency of result.competencies) {
    competency.rating = "strong-positive";
    competency.evidence[0].observation = context.interview.messages[0].content;
  }
  assert.doesNotThrow(() =>
    validateResult({ ...result, recommendation: "strong-hire" }, context),
  );
});
test("interruption is distinct from demonstrated weakness and incomplete opportunity", () => {
  const { context, result } = fixture();
  context.interview.endReason = "candidate-finished";
  for (const competency of result.competencies)
    Object.assign(competency, { rating: "not-assessed", evidence: [] });
  assert.throws(
    () => validateResult(result, context),
    IncompleteEvaluationError,
  );
  Object.assign(result.competencies[0], {
    rating: "negative",
    evidence: [
      {
        observation: "Candidate chose to reuse the same index.",
        messageId: context.interview.messages[0].id,
      },
    ],
  });
  context.interview.messages[0].content =
    "I will use the same element twice despite the distinct-index requirement.";
  assert.doesNotThrow(() =>
    validateResult({ ...result, recommendation: "no-hire" }, context),
  );
  assert.throws(
    () => validateResult({ ...result, recommendation: "strong-hire" }, context),
    /Strong Hire/,
  );
});
test("mixed ratings contradict Strong Hire; calibration instructions align verdict and feedback with selected level", () => {
  const { context, result } = fixture();
  result.competencies[0].rating = "mixed";
  assert.throws(
    () => validateResult({ ...result, recommendation: "strong-hire" }, context),
    /Strong Hire/,
  );
  const prompt = readFileSync("content/prompts/evaluator.md", "utf8");
  assert.match(prompt, /Separate solution correctness/);
  assert.match(
    prompt,
    /Problem difficulty alone must neither upgrade nor downgrade/,
  );
  assert.match(prompt, /recommendation, competency ratings, finalAssessment/);
  assert.match(prompt, /do not invent advanced competency/);
});
