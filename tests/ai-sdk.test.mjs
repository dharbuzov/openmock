import { test } from "node:test";
import assert from "node:assert/strict";
import { MockLanguageModelV3 } from "ai/test";
import { load } from "./register-typescript.mjs";

const { startInterview, acceptCandidateMessage } = load("../src/lib/interview/engine.ts");
const { requireInterviewDefinition } = load("../src/lib/interview/definitions.ts");
const { generateInterviewResponseWithModel, AIProviderError } = load("../src/lib/ai/provider.ts");
const { evaluateInterviewWithModel } = load("../src/lib/ai/evaluation.ts");

const mockResult = (text) => ({
  content: [{ type: "text", text }], finishReason: { unified: "stop", raw: "stop" },
  usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
});
const problem = {
  id: "two-sum", title: "Two Sum", interview: "dsa", complexity: "low",
  categories: ["algorithms"], topics: ["hash-map"], companies: [], tags: [],
  content: "Return matching indices.", language: "java", starterCode: "class Solution {}",
};
const definition = requireInterviewDefinition("dsa");

test("provider returns the shared structured InterviewTurn model", async () => {
  const interview = acceptCandidateMessage(startInterview(problem, { definition, targetLevel: "senior", mode: "practice" }), "I will use a hash map.");
  const output = {
    message: "What are the complexity costs?", stageComplete: true,
    observations: [{ id: "obs-1", competencyId: "problem-solving", observation: "Candidate selected a hash map.", messageId: interview.messages[0].id }],
  };
  const model = new MockLanguageModelV3({ doGenerate: mockResult(JSON.stringify(output)) });
  const turn = await generateInterviewResponseWithModel(model, {
    interview, problem, definition,
    workspace: { type: "code", language: "Java", filename: "Solution.java", code: "class Solution {}" },
  });
  assert.deepEqual(turn, output);
  const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
  assert.match(prompt, /targetLevel/);
  assert.match(prompt, /Solution\.java/);
  assert.match(prompt, /hash map/);
});

test("provider failures remain safe", async () => {
  const interview = acceptCandidateMessage(startInterview(problem, { definition, targetLevel: "senior", mode: "practice" }), "Hello");
  const model = new MockLanguageModelV3({ doGenerate: async () => { throw new Error("secret"); } });
  await assert.rejects(
    generateInterviewResponseWithModel(model, { interview, problem, definition, workspace: { type: "code", language: "Java", filename: "Solution.java", code: "" } }),
    (error) => error instanceof AIProviderError && !error.message.includes("secret"),
  );
});

test("evaluation is qualitative, holistic, and preserves not-assessed", async () => {
  const interview = acceptCandidateMessage(startInterview(problem, { definition, targetLevel: "senior", mode: "practice" }), "I will use a hash map.");
  const competencies = definition.evaluation.competencies.map(({ id }, index) => ({
    competencyId: id,
    rating: index === 3 ? "not-assessed" : "positive",
    summary: index === 3 ? "No evidence." : "Grounded evidence.",
    evidence: index === 3 ? [] : [{ observation: "Candidate selected a hash map.", messageId: interview.messages[0].id, stage: "approach" }],
  }));
  const output = {
    recommendation: "hire", competencies,
    strengths: [{ observation: "Selected an efficient lookup structure.", messageId: interview.messages[0].id, stage: "approach" }],
    concerns: [], keyMoments: [], summary: "A promising start.", finalAssessment: "The evidence supports a hire recommendation.",
  };
  const model = new MockLanguageModelV3({ doGenerate: mockResult(JSON.stringify(output)) });
  const result = await evaluateInterviewWithModel(model, {
    interview, problem, definition,
    workspace: { type: "code", language: "Java", filename: "Solution.java", code: "class Solution {}" },
  });
  assert.equal(result.recommendation, "hire");
  assert.equal(result.competencies.at(-1).rating, "not-assessed");
  assert.equal("score" in result, false);
  assert.equal(result.interviewId, interview.id);
});
