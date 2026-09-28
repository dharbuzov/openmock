import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";

const load = createRequire(import.meta.url);
load.extensions[".ts"] = (module, filename) => {
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  module._compile(outputText, filename);
};

const provider = load("../src/lib/ai/provider.ts");
const evaluation = load("../src/lib/ai/evaluation.ts");
const {
  acceptCandidateMessage,
  buildEvaluationContext,
  buildInterviewContext,
  finishInterview,
  processCandidateMessage,
  startInterview,
} = load("../src/lib/interview/engine.ts");

const dsaProblem = {
  id: "two-sum",
  title: "Two Sum",
  type: "dsa",
  level: "Easy",
  tags: ["array"],
  content: "Return the two matching indices.",
};

const designProblem = {
  id: "url-shortener",
  title: "Design a URL Shortener",
  type: "system-design",
  level: "Medium",
  tags: ["distributed-systems"],
  content: "Design a URL shortener.",
};

test("startInterview creates real problem IDs and type-owned initial state", () => {
  const dsa = startInterview(dsaProblem);
  assert.equal(dsa.id, "two-sum");
  assert.deepEqual(dsa.messages, []);
  assert.deepEqual(dsa.workspaceSnapshot, { kind: "dsa" });
  assert.equal(dsa.systemDesignState, null);

  const design = startInterview(designProblem);
  assert.equal(design.id, "url-shortener");
  assert.equal(design.messages[0].role, "assistant");
  assert.match(design.messages[0].content, /what requirements would you like to clarify/i);
  assert.equal(design.systemDesignState.phase, "clarification");
  assert.deepEqual(design.workspaceSnapshot.architectureDiagram, { nodes: [], edges: [] });
});

test("candidate turns build context with the matching current workspace snapshot", async () => {
  const code = { language: "typescript", content: "const seen = new Map();" };
  const candidateTurn = acceptCandidateMessage(startInterview(dsaProblem), "  I would use a hash map.  ");
  const context = buildInterviewContext(candidateTurn, { kind: "dsa", code });
  assert.equal(context.messages[0].content, "I would use a hash map.");
  assert.deepEqual(context.code, code);

  let generatedContext;
  provider.generateInterviewResponse = async (_settings, request) => {
    generatedContext = request;
    return { content: "What are the time and space costs?" };
  };
  const updated = await processCandidateMessage({}, candidateTurn, { kind: "dsa", code });
  assert.equal(updated.messages.at(-1).role, "assistant");
  assert.equal(updated.messages.at(-1).content, "What are the time and space costs?");
  assert.deepEqual(updated.workspaceSnapshot, { kind: "dsa", code });
  assert.deepEqual(generatedContext.code, code);
});

test("System Design context includes progress and only the supplied normalized diagram", () => {
  const interview = acceptCandidateMessage(startInterview(designProblem), "Redirects need low latency.");
  const architectureDiagram = {
    nodes: [{ id: "api", type: "rectangle", label: "API" }],
    edges: [],
  };
  const context = buildInterviewContext(interview, { kind: "system-design", architectureDiagram });
  assert.equal(context.systemDesignState.phase, "clarification");
  assert.deepEqual(context.architectureDiagram, architectureDiagram);
  assert.equal("code" in context, false);
});

test("System Design turns update engine-owned progress and workspace state", async () => {
  const interview = acceptCandidateMessage(startInterview(designProblem), "Redirects need low latency.");
  const architectureDiagram = {
    nodes: [{ id: "api", type: "rectangle", label: "API" }],
    edges: [],
  };
  const turn = {
    response: "What p99 latency target should we design for?",
    state: {
      phase: "clarification",
      coveredTopics: ["latency"],
      establishedRequirements: [{
        statement: "Redirects need low latency",
        evidenceCandidateMessageIndex: 0,
      }],
      assumptions: [],
      decisions: [],
      unresolvedQuestions: ["Target p99 latency"],
      challengeAreas: [],
      candidateSignal: "steady",
    },
  };
  provider.generateInterviewResponse = async () => ({
    content: turn.response,
    systemDesignState: turn.state,
  });
  const updated = await processCandidateMessage({}, interview, {
    kind: "system-design",
    architectureDiagram,
  });

  assert.equal(updated.messages.at(-1).content, turn.response);
  assert.deepEqual(updated.systemDesignState.establishedRequirements, turn.state.establishedRequirements);
  assert.deepEqual(updated.workspaceSnapshot.architectureDiagram, architectureDiagram);
});

test("finishInterview evaluates the current evidence and completes the same interview", async () => {
  const code = { language: "typescript", content: "const seen = new Map<number, number>();" };
  const interview = acceptCandidateMessage(startInterview(dsaProblem), "I use a hash map for constant-time lookup.");
  const category = (score, summary, source = "candidate-message") => ({
    score,
    summary,
    evidence: [{ source, sourceIndex: 0, observation: summary }],
  });
  const structured = {
    interviewType: "dsa",
    overallScore: 0,
    hiringSignal: "yes",
    summary: "The candidate chose an appropriate approach.",
    strengths: ["Connected lookup cost to the data structure."],
    improvements: ["Discuss edge cases."],
    insufficientEvidence: ["No testing discussion."],
    categories: {
      problemSolving: category(4, "Proposed a hash map."),
      communication: category(3, "Explained the lookup goal."),
      technicalDepth: category(4, "The code creates a map.", "code"),
      tradeoffs: category(2, "Did not compare alternatives."),
    },
  };
  let evaluationContext;
  evaluation.evaluateInterview = async (_settings, request) => {
    evaluationContext = request;
    return { ...structured, overallScore: 65 };
  };
  const stored = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: (key) => stored.delete(key),
  };
  const finished = await finishInterview({}, interview, { kind: "dsa", code });

  assert.equal(finished.interview.id, "two-sum");
  assert.equal(finished.interview.status, "completed");
  assert.deepEqual(finished.interview.workspaceSnapshot, { kind: "dsa", code });
  assert.equal(finished.evaluation.overallScore, 65);
  assert.deepEqual(buildEvaluationContext(interview, { kind: "dsa", code }).code, code);
  assert.match(JSON.stringify(evaluationContext), /constant-time lookup/);
  assert.match(JSON.stringify(evaluationContext), /new Map/);
  assert.ok([...stored.values()][0].includes("The candidate chose an appropriate approach."));
  delete globalThis.sessionStorage;
});

test("workspace snapshots cannot cross interview types", () => {
  assert.throws(
    () => buildInterviewContext(startInterview(dsaProblem), {
      kind: "system-design",
      architectureDiagram: { nodes: [], edges: [] },
    }),
    /does not match/,
  );
});
