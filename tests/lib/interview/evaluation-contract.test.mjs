import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MockLanguageModelV3 } from "ai/test";
import { load, storage } from "../../register-typescript.mjs";
import { loadDefinition } from "../../content-fixtures.mjs";
import { loadComponent } from "../../helpers/components.mjs";

const {
  startInterview,
  completeInterview,
  acceptCandidateMessage,
  emptyWorkspaceSnapshot,
} = load("../src/lib/interview/engine.ts");
const evaluator = load("../src/lib/ai/evaluation.ts");
const runner = load("../src/lib/interview/runner.ts");
const persistence = load("../src/lib/interview/evaluation-storage.ts");
const { ResultsScorecard } = loadComponent(
  "src/components/interview-results.tsx",
);
const definition = loadDefinition("system-design");
const problem = {
  id: "url-shortener",
  title: "Design a URL Shortener",
  interview: definition.id,
};
function fixture() {
  const interview = completeInterview(
    acceptCandidateMessage(
      startInterview(problem, { definition, targetLevel: "staff" }),
      "I am finished.",
    ),
  );
  interview.startedAt = "2026-10-02T12:00:00.000Z";
  interview.completedAt = "2026-10-02T12:12:00.000Z";
  const context = {
    interview,
    definition,
    problem,
    workspace: emptyWorkspaceSnapshot(definition.workspace),
  };
  const result = {
    interviewId: interview.id,
    problemId: problem.id,
    definition: interview.definition,
    targetLevel: interview.targetLevel,
    recommendation: "no-hire",
    competencies: definition.evaluation.competencies.map(({ id }) => ({
      competencyId: id,
      rating: "not-demonstrated",
      summary: "Expected work was absent before the candidate finished.",
      evidence: [],
    })),
    strengths: [],
    concerns: [],
    keyMoments: [],
    summary: "The candidate did not demonstrate the required competencies.",
    finalAssessment:
      "The candidate did not demonstrate sufficient evidence for the target level.",
    createdAt: "2026-10-02T12:12:01.000Z",
  };
  return { context, result };
}

test("required competencies with no demonstration reject Hire and Strong Hire", () => {
  const { context, result } = fixture();
  for (const recommendation of ["hire", "strong-hire"])
    assert.throws(
      () => evaluator.validateResult({ ...result, recommendation }, context),
      /no required competency/,
    );
  assert.doesNotThrow(() => evaluator.validateResult(result, context));
});

test("required metadata controls invariants, without interview-type rules", () => {
  const { context, result } = fixture();
  const modified = {
    ...context,
    definition: {
      ...definition,
      evaluation: {
        ...definition.evaluation,
        competencies: definition.evaluation.competencies.map((item, i) => ({
          ...item,
          required: i === 0,
        })),
      },
    },
  };
  const competencies = result.competencies.map((item, i) =>
    i === 1
      ? {
          ...item,
          rating: "positive",
          evidence: [{ observation: "Actual workspace work." }],
        }
      : item,
  );
  assert.throws(
    () =>
      evaluator.validateResult(
        { ...result, recommendation: "hire", competencies },
        modified,
      ),
    /no required competency/,
  );
});

test("normal completion may have not-demonstrated; interruption may have not-assessed", () => {
  const { context, result } = fixture();
  assert.doesNotThrow(() => evaluator.validateResult(result, context));
  const competencies = result.competencies.map((item, i) =>
    i
      ? item
      : {
          ...item,
          rating: "not-assessed",
          summary: "Interrupted before discussion.",
        },
  );
  const interrupted = {
    ...context,
    interview: { ...context.interview, endReason: "error" },
  };
  assert.doesNotThrow(() =>
    evaluator.validateResult({ ...result, competencies }, interrupted),
  );
  const unassessed = result.competencies.map((item) => ({
    ...item,
    rating: "not-assessed",
  }));
  assert.throws(
    () =>
      evaluator.validateResult(
        { ...result, competencies: unassessed },
        context,
      ),
    evaluator.IncompleteEvaluationError,
  );
  assert.throws(
    () =>
      evaluator.validateResult(
        { ...result, competencies: unassessed },
        interrupted,
      ),
    evaluator.IncompleteEvaluationError,
  );
});

test("valid evidence-based Hire and No Hire evaluations remain valid", () => {
  const { context, result } = fixture();
  const competencies = result.competencies.map((item) => ({
    ...item,
    rating: "positive",
    evidence: [
      {
        observation: "Candidate supplied an approach.",
        messageId: context.interview.messages[0].id,
      },
    ],
  }));
  assert.doesNotThrow(() =>
    evaluator.validateResult(
      { ...result, recommendation: "hire", competencies },
      context,
    ),
  );
  assert.doesNotThrow(() => evaluator.validateResult(result, context));
  assert.throws(
    () =>
      evaluator.validateResult(
        { ...result, recommendation: "unsupported" },
        context,
      ),
    /not in the rubric/,
  );
  assert.throws(
    () =>
      evaluator.validateResult(
        {
          ...result,
          competencies: result.competencies.map((item, i) =>
            i ? item : { ...item, competencyId: "unknown" },
          ),
        },
        context,
      ),
    /match the rubric/,
  );
});

test("original non-participation regression passes SDK validation, storage, and collapsed scorecard rendering", async () => {
  const { context, result } = fixture();
  const { interviewId } = result;
  const output = Object.fromEntries(
    Object.entries(result).filter(
      ([key]) =>
        ![
          "interviewId",
          "problemId",
          "definition",
          "targetLevel",
          "createdAt",
        ].includes(key),
    ),
  );
  const model = new MockLanguageModelV3({
    doGenerate: {
      content: [{ type: "text", text: JSON.stringify(output) }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
    },
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(readFileSync("content/prompts/evaluator.md", "utf8"));
  globalThis.sessionStorage = storage();
  try {
    const evaluated = await evaluator.evaluateInterviewWithModel(
      model,
      context,
    );
    assert.equal(evaluated.recommendation, "no-hire");
    assert.ok(
      evaluated.competencies.every(
        (item) => item.rating === "not-demonstrated",
      ),
    );
    persistence.saveResultsRecord(
      {
        interview: context.interview,
        evaluation: { status: "completed", result: evaluated },
      },
      problem,
      definition,
    );
    const record = persistence.parseResultsRecord(
      persistence.readResultsRecordValue(interviewId),
    );
    const html = renderToStaticMarkup(
      createElement(ResultsScorecard, { record, interviewId }),
    );
    assert.match(html, />No Hire</);
    assert.doesNotMatch(html, />Hire</);
    assert.equal(
      (html.match(/>Not demonstrated</g) ?? []).length,
      definition.evaluation.competencies.length,
    );
    assert.doesNotMatch(html, new RegExp(interviewId));
    assert.doesNotMatch(
      html,
      /no-hire|No evidence recorded|Expected work was absent/,
    );
    assert.equal(
      (html.match(/aria-expanded="false"/g) ?? []).length,
      definition.evaluation.competencies.length,
    );
    assert.match(html, /Requirements &amp; Scope/);
    assert.match(html, /12 min/);
    assert.match(html, /0 of 8 demonstrated/);
    assert.doesNotMatch(html, /demonstrated positively/);
    const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
    assert.match(prompt, /candidate-finished/);
    assert.match(prompt, /not-demonstrated/);
    for (const recommendation of ["hire", "strong-hire"]) {
      const inconsistent = new MockLanguageModelV3({
        doGenerate: {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ...output, recommendation }),
            },
          ],
          finishReason: { unified: "stop", raw: "stop" },
          usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } },
        },
      });
      await assert.rejects(
        evaluator.evaluateInterviewWithModel(inconsistent, context),
        /no required competency/,
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.sessionStorage;
  }
});

test("failed and legitimately incomplete outcomes never fabricate a recommendation", async () => {
  const { context } = fixture();
  const original = evaluator.evaluateInterview;
  globalThis.sessionStorage = storage();
  try {
    for (const [error, status] of [
      [new Error("provider failed"), "failed"],
      [
        new evaluator.IncompleteEvaluationError(
          "Interview interrupted before assessment.",
        ),
        "incomplete",
      ],
    ]) {
      evaluator.evaluateInterview = async () => {
        throw error;
      };
      const finished = await runner.retryEvaluation(
        {},
        context.interview,
        problem,
        definition,
      );
      assert.equal(finished.evaluation.status, status);
      assert.equal("result" in finished.evaluation, false);
      persistence.saveResultsRecord(finished, problem, definition);
      const record = persistence.parseResultsRecord(
        persistence.readResultsRecordValue(context.interview.id),
      );
      const html = renderToStaticMarkup(
        createElement(ResultsScorecard, {
          record,
          interviewId: context.interview.id,
        }),
      );
      assert.match(html, /No hiring recommendation available/);
      assert.doesNotMatch(html, />No Hire<|>Hire<|Not assessed/);
    }
  } finally {
    evaluator.evaluateInterview = original;
    delete globalThis.sessionStorage;
  }
});

test("finishing immediately produces incomplete evaluation rather than technical failure", async () => {
  const { context, result } = fixture();
  const interview = completeInterview(startInterview(problem, { definition }));
  const competencies = result.competencies.map((item) => ({
    ...item,
    rating: "not-assessed",
    summary: "Interview ended before this competency could be assessed.",
  }));
  const original = evaluator.evaluateInterview;
  evaluator.evaluateInterview = async (_settings, current) => {
    evaluator.validateResult({ ...result, competencies }, current);
    throw new Error("Expected incomplete assessment");
  };
  try {
    const finished = await runner.retryEvaluation(
      {},
      interview,
      problem,
      definition,
      context.workspace,
    );
    assert.equal(finished.evaluation.status, "incomplete");
    assert.equal("result" in finished.evaluation, false);
  } finally {
    evaluator.evaluateInterview = original;
  }
});

test("abusive response can assess communication negatively while technical competencies remain unassessed", () => {
  const { context, result } = fixture();
  const interview = completeInterview(
    acceptCandidateMessage(
      startInterview(problem, { definition }),
      "Fuck you.",
    ),
  );
  const competencies = result.competencies.map((item) =>
    item.competencyId === "communication"
      ? {
          ...item,
          rating: "negative",
          summary: "Candidate responded abusively.",
          evidence: [
            {
              observation: "Candidate responded with abusive language.",
              messageId: interview.messages[0].id,
            },
          ],
        }
      : {
          ...item,
          rating: "not-assessed",
          summary: "No meaningful technical discussion occurred.",
        },
  );
  assert.doesNotThrow(() =>
    evaluator.validateResult(
      { ...result, competencies, recommendation: "no-hire" },
      { ...context, interview },
    ),
  );
});

test("incomplete model evaluation logs an informational outcome without an error stack", async () => {
  const { context, result } = fixture();
  const output = {
    recommendation: "no-hire",
    summary: result.summary,
    finalAssessment: result.finalAssessment,
    competencies: result.competencies.map((item) => ({
      ...item,
      rating: "not-assessed",
    })),
    strengths: [],
    concerns: [],
    keyMoments: [],
  };
  const model = new MockLanguageModelV3({
    doGenerate: {
      content: [{ type: "text", text: JSON.stringify(output) }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } },
    },
  });
  const { installLogger, levels } = load("../src/lib/logging/logger.ts");
  const loggerKey = Symbol.for("openmock.logger");
  const previousLogger = globalThis[loggerKey];
  const previousFetch = globalThis.fetch;
  const logs = [];
  installLogger({
    isLevelEnabled: () => true,
    ...Object.fromEntries(
      levels.map((level) => [
        level,
        (context, event) => logs.push({ level, context, event }),
      ]),
    ),
  });
  globalThis.fetch = async () =>
    new Response(readFileSync("content/prompts/evaluator.md", "utf8"));
  try {
    await assert.rejects(
      evaluator.evaluateInterviewWithModel(model, context),
      evaluator.IncompleteEvaluationError,
    );
    assert.ok(
      logs.some(
        (entry) =>
          entry.level === "info" && entry.event === "Evaluation incomplete",
      ),
    );
    assert.equal(
      logs.some((entry) => entry.level === "error"),
      false,
    );
    assert.equal(
      logs.some((entry) => entry.context.err),
      false,
    );
  } finally {
    globalThis[loggerKey] = previousLogger;
    globalThis.fetch = previousFetch;
  }
});

test("scorecard promotes canonical recommendation and rationale and omits empty sections", () => {
  const { context, result } = fixture();
  const record = {
    context: {
      problemTitle: problem.title,
      definitionName: definition.name,
      levelName: "Staff",
      competencies: definition.evaluation.competencies,
      startedAt: context.interview.startedAt,
      completedAt: context.interview.completedAt,
    },
    evaluation: { status: "completed", result },
  };
  const html = renderToStaticMarkup(
    createElement(ResultsScorecard, {
      record,
      interviewId: context.interview.id,
    }),
  );
  assert.match(html, /data-size="lg"/);
  assert.match(
    html,
    /The candidate did not demonstrate sufficient evidence for the target level/,
  );
  assert.match(html, /0 of 8 demonstrated/);
  assert.doesNotMatch(
    html,
    /demonstrated positively|>Strengths<|>Concerns<|>Key moments<|>Evidence<|No evidence recorded/,
  );
  assert.doesNotMatch(html, new RegExp(context.interview.id));
  const varied = {
    ...record,
    evaluation: {
      status: "completed",
      result: {
        ...result,
        competencies: result.competencies.map((item, i) =>
          i ? item : { ...item, rating: "not-assessed" },
        ),
      },
    },
  };
  const variedHtml = renderToStaticMarkup(
    createElement(ResultsScorecard, {
      record: varied,
      interviewId: context.interview.id,
    }),
  );
  assert.match(variedHtml, />Not assessed</);
  assert.match(variedHtml, />Not demonstrated</);
  record.context.completedAt = "2026-10-02T13:04:00.000Z";
  assert.match(
    renderToStaticMarkup(
      createElement(ResultsScorecard, {
        record,
        interviewId: context.interview.id,
      }),
    ),
    /1 hr 4 min/,
  );
});

test("evidence deduplication removes exact normalized duplicates and retains distinct citations", () => {
  const { context, result } = fixture();
  const first = {
    observation: "Candidate identified core functionality.",
    messageId: context.interview.messages[0].id,
    stage: "requirements",
  };
  const evidence = [
    first,
    { ...first, observation: `  ${first.observation}  ` },
    { ...first, observation: "Candidate clarified the expected scale." },
    { ...first, stage: "wrap-up" },
  ];
  const { deduplicateResultEvidence, interviewResultSchema } = load(
    "../src/lib/interview/result-schema.ts",
  );
  const input = {
    ...result,
    strengths: evidence,
    concerns: evidence,
    keyMoments: evidence,
    competencies: result.competencies.map((item) => ({ ...item, evidence })),
  };
  const normalized = deduplicateResultEvidence(input);
  for (const items of [
    normalized.strengths,
    normalized.concerns,
    normalized.keyMoments,
    ...normalized.competencies.map((item) => item.evidence),
  ]) {
    assert.equal(items.length, 3);
    assert.deepEqual(items, [evidence[0], evidence[2], evidence[3]]);
  }
  assert.equal(input.strengths.length, 4);
  globalThis.sessionStorage = storage();
  try {
    persistence.saveResultsRecord(
      {
        interview: context.interview,
        evaluation: { status: "completed", result: input },
      },
      problem,
      definition,
    );
    const parsed = persistence.parseResultsRecord(
      persistence.readResultsRecordValue(context.interview.id),
    );
    assert.equal(parsed.evaluation.result.concerns.length, 3);
  } finally {
    delete globalThis.sessionStorage;
  }
  assert.equal(
    interviewResultSchema.safeParse({ ...result, finalAssessment: "no-hire" })
      .success,
    false,
  );
});

test("expanded competency panels show secondary evidence only when it exists", () => {
  const { context, result } = fixture();
  const accordion = loadComponent("src/components/ui/accordion.tsx");
  const { ResultsScorecard: ExpandedScorecard } = loadComponent(
    "src/components/interview-results.tsx",
    {
      "@/components/ui/accordion": {
        ...accordion,
        Accordion: (props) =>
          createElement(accordion.Accordion, {
            ...props,
            defaultValue: result.competencies
              .slice(0, 2)
              .map((item) => item.competencyId),
          }),
      },
    },
  );
  const record = {
    context: {
      problemTitle: problem.title,
      definitionName: definition.name,
      levelName: "Staff",
      competencies: definition.evaluation.competencies,
      startedAt: context.interview.startedAt,
      completedAt: context.interview.completedAt,
    },
    evaluation: {
      status: "completed",
      result: {
        ...result,
        competencies: result.competencies.map((item, index) => ({
          ...item,
          evidence:
            index === 0
              ? [{ observation: "Candidate identified core functionality." }]
              : [],
        })),
      },
    },
  };
  const html = renderToStaticMarkup(
    createElement(ExpandedScorecard, {
      record,
      interviewId: context.interview.id,
    }),
  );
  assert.equal((html.match(/aria-expanded="true"/g) ?? []).length, 2);
  assert.match(html, /Expected work was absent before the candidate finished/);
  assert.match(html, /Candidate identified core functionality/);
  assert.equal((html.match(/>Evidence</g) ?? []).length, 1);
  assert.doesNotMatch(html, /No evidence recorded/);
});
