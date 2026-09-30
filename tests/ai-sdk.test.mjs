import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MockLanguageModelV3 } from "ai/test";
import { load } from "./register-typescript.mjs";
import { loadDefinition } from "./content-fixtures.mjs";

const { startInterview, acceptCandidateMessage } = load("../src/lib/interview/engine.ts");
const { generateInterviewResponseWithModel, AIProviderError } = load("../src/lib/ai/provider.ts");
const { evaluateInterviewWithModel } = load("../src/lib/ai/evaluation.ts");

const mockResult = (text) => ({
  content: [{ type: "text", text }], finishReason: { unified: "stop", raw: "stop" },
  usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
});
const problem = {
  id: "two-sum", title: "Two Sum", interview: "dsa", complexity: "low",
  categories: ["algorithms"], topics: ["hash-map"], companies: [], tags: [],
  content: "Return matching indices.", interviewerContext: "Probe duplicate values.", language: "java", starterCode: "class Solution {}",
};
const definition = loadDefinition("dsa");
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const match = /^\/api\/prompts\/(interviewer|evaluator)$/.exec(String(url));
  if (!match) return originalFetch(url);
  return new Response(readFileSync(new URL(`../prompts/${match[1]}.md`, import.meta.url), "utf8"));
};
test.after(() => { globalThis.fetch = originalFetch; });

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
  assert.match(prompt, /practice/);
  assert.match(prompt, /approach/);
  assert.match(prompt, /elapsedMinutes/);
  assert.match(prompt, /remainingMinutes/);
  assert.match(prompt, /Data Structures and Algorithms Interview/);
  assert.match(prompt, /Probe duplicate values/);
  assert.match(prompt, /Solution\.java/);
  assert.match(prompt, /hash map/);
});

test("system design context includes the normalized diagram through the generic workspace", async () => {
  const systemDefinition = loadDefinition("system-design");
  const systemProblem = {
    id: "url-shortener", title: "URL Shortener", interview: "system-design", complexity: "low",
    categories: [], topics: [], companies: [], tags: [], content: "Design a shortener.",
  };
  const interview = acceptCandidateMessage(startInterview(systemProblem, {
    definition: systemDefinition, targetLevel: "staff", mode: "mock",
  }), "I will place a cache before the database.");
  const output = { message: "What happens if the cache fails?", stageComplete: false, observations: [] };
  const model = new MockLanguageModelV3({ doGenerate: mockResult(JSON.stringify(output)) });
  await generateInterviewResponseWithModel(model, {
    interview, problem: systemProblem, definition: systemDefinition,
    workspace: { type: "diagram", diagram: {
      nodes: [{ id: "cache", type: "rectangle", label: "Redis" }], edges: [],
    } },
  });
  const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
  assert.match(prompt, /System Design Interview/);
  assert.match(prompt, /Redis/);
  assert.match(prompt, /cache before the database/);
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
  const competencies = definition.evaluation.competencies.map(({ id }) => ({
    competencyId: id,
    rating: id === "trade-offs" ? "not-assessed" : "positive",
    summary: id === "trade-offs" ? "No evidence." : "Grounded evidence.",
    evidence: id === "trade-offs" ? [] : [{ observation: "Candidate selected a hash map.", messageId: interview.messages[0].id, stage: "approach" }],
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

test("generic evaluator accepts competencies loaded from the behavioral definition", async () => {
  const behavioralDefinition = loadDefinition("behavioral");
  const behavioralProblem = {
    id: "conflict-with-teammate", title: "Conflict", interview: "behavioral", complexity: "medium",
    categories: [], topics: [], companies: [], tags: [], content: "Tell me about a conflict.",
    interviewerContext: "Probe the candidate's contribution.",
  };
  const interview = acceptCandidateMessage(startInterview(behavioralProblem, {
    definition: behavioralDefinition, targetLevel: "staff", mode: "mock",
  }), "I brought both engineers together and clarified the shared goal.");
  const output = {
    recommendation: "hire",
    competencies: behavioralDefinition.evaluation.competencies.map(({ id }) => ({
      competencyId: id, rating: id === "collaboration" ? "positive" : "not-assessed",
      summary: id === "collaboration" ? "Demonstrated collaboration." : "Not enough evidence.",
      evidence: id === "collaboration" ? [{ observation: "Brought both engineers together.", messageId: interview.messages[0].id, stage: "introduction" }] : [],
    })),
    strengths: [{ observation: "Clarified a shared goal.", messageId: interview.messages[0].id }],
    concerns: [], keyMoments: [], summary: "Evidence of collaboration.", finalAssessment: "The available evidence supports hire.",
  };
  const model = new MockLanguageModelV3({ doGenerate: mockResult(JSON.stringify(output)) });
  const result = await evaluateInterviewWithModel(model, {
    interview, problem: behavioralProblem, definition: behavioralDefinition, workspace: { type: "none" },
  });
  assert.equal(result.competencies.length, behavioralDefinition.evaluation.competencies.length);
  assert.equal(result.competencies.find(({ competencyId }) => competencyId === "collaboration").rating, "positive");
});
