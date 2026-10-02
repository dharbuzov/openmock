import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MockLanguageModelV3 } from "ai/test";
import { load } from "../../register-typescript.mjs";
import { loadDefinition } from "../../content-fixtures.mjs";

const engine = load("../src/lib/interview/engine.ts");
const runner = load("../src/lib/interview/runner.ts");
const evaluator = load("../src/lib/ai/evaluation.ts");
const provider = load("../src/lib/ai/provider.ts");
const definition = loadDefinition("behavioral");
const problem = { id: "example", interview: definition.id };
const start = () => engine.startInterview(problem, { definition });

test("evaluation failure preserves completion and retry reuses the completed interview", async () => {
  const original = evaluator.evaluateInterview;
  let evaluated;
  let committed;
  evaluator.evaluateInterview = async (_settings, context) => {
    evaluated = context.interview;
    assert.equal(committed, context.interview);
    throw new Error("Provider unavailable sk-THIS_MUST_NEVER_APPEAR");
  };
  try {
    const initial = start();
    const finished = await runner.finishInterview(
      {},
      initial,
      problem,
      definition,
      undefined,
      undefined,
      (completed) => {
        committed = completed;
      },
    );
    assert.equal(evaluated.status, "completed");
    assert.equal(finished.interview, evaluated);
    assert.equal(finished.evaluation.status, "failed");
    assert.ok(
      !JSON.stringify(finished.evaluation).includes(
        "sk-THIS_MUST_NEVER_APPEAR",
      ),
    );
    const result = { interviewId: finished.interview.id };
    evaluator.evaluateInterview = async (_settings, context) => {
      assert.equal(context.interview, finished.interview);
      return result;
    };
    const retried = await runner.retryEvaluation(
      {},
      finished.interview,
      problem,
      definition,
    );
    assert.equal(retried.interview, finished.interview);
    assert.equal(retried.interview.completedAt, finished.interview.completedAt);
    assert.deepEqual(retried.evaluation, { status: "completed", result });
    await assert.rejects(
      runner.finishInterview({}, finished.interview, problem, definition),
      /in-progress/,
    );
    await assert.rejects(
      runner.retryEvaluation({}, initial, problem, definition),
      /completed/,
    );
  } finally {
    evaluator.evaluateInterview = original;
  }
});

test("runner validates context and active stage before calling AI", async () => {
  const original = provider.generateInterviewResponse;
  let calls = 0;
  provider.generateInterviewResponse = async () => {
    calls++;
    throw new Error("unexpected AI call");
  };
  try {
    const candidate = engine.acceptCandidateMessage(start(), "Answer");
    for (const current of [null, "unknown"])
      await assert.rejects(
        runner.processCandidateMessage(
          {},
          { ...candidate, stage: { ...candidate.stage, current } },
          problem,
          definition,
        ),
        /stage/,
      );
    await assert.rejects(
      runner.processCandidateMessage({}, candidate, problem, {
        ...definition,
        revision: "changed",
      }),
      /definition does not match/,
    );
    await assert.rejects(
      runner.finishInterview({}, candidate, problem, definition, {
        type: "code",
        code: "",
      }),
      /workspace snapshot/,
    );
    assert.equal(calls, 0);
  } finally {
    provider.generateInterviewResponse = original;
  }
});

test("raw invalid model output fails at the provider boundary before engine transitions", async () => {
  const original = provider.generateInterviewResponse;
  const model = new MockLanguageModelV3({
    doGenerate: {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            message: "Next",
            stageComplete: "yes",
            observations: [],
          }),
        },
      ],
      finishReason: { unified: "stop", raw: "stop" },
      usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } },
    },
  });
  provider.generateInterviewResponse = (_settings, context) =>
    provider.generateInterviewResponseWithModel(model, context);
  try {
    const candidate = engine.acceptCandidateMessage(start(), "Answer");
    await assert.rejects(
      runner.processCandidateMessage({}, candidate, problem, definition),
      provider.AIProviderError,
    );
    assert.equal(candidate.stage.current, definition.stages[0].id);
    assert.equal(candidate.messages.length, 1);
    assert.deepEqual(candidate.stage.completed, []);
  } finally {
    provider.generateInterviewResponse = original;
  }
});

test("engine has no AI settings, integrations or operational logging", () => {
  const source = readFileSync("src/lib/interview/engine.ts", "utf8");
  assert.ok(
    !/AISettings|import\(|logger|generateInterviewResponse|evaluateInterview/.test(
      source,
    ),
  );
  assert.ok(!/"(?:senior|practice|system-design|dsa|behavioral)"/.test(source));
});
