import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../register-typescript.mjs";
import { loadDefinition } from "../../content-fixtures.mjs";
import { readFileSync } from "node:fs";
import { MockLanguageModelV3 } from "ai/test";

const { startInterview, buildInterviewContext } = load(
  "../src/lib/interview/engine.ts",
);
const { interviewerInput, assertContextBudget } = load(
  "../src/lib/ai/prompts.ts",
);
const { generateInterviewResponseWithModel } = load(
  "../src/lib/ai/provider.ts",
);

test("opening publishes one candidate-led question without sending problem guidance to a model", async () => {
  for (const id of ["dsa", "system-design", "sql"]) {
    const base = loadDefinition(id === "sql" ? "dsa" : id);
    const definition = { ...base, id };
    const problem = {
      id: "opening-example",
      interview: id,
      title: "Example Problem",
      content:
        "A retry after a timeout may charge twice. Consider idempotency and edge cases.",
      interviewerContext:
        "Probe requirements, constraints and scale before design.",
    };
    const interview = startInterview(problem, { definition });
    const context = buildInterviewContext(interview, problem, definition);
    const before = structuredClone(context);
    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        throw new Error("Opening must not call the model");
      },
      doStream: async () => {
        throw new Error("Opening must not stream from the model");
      },
    });
    for (const streaming of [false, true]) {
      const displayed = [];
      const turn = await generateInterviewResponseWithModel(
        model,
        context,
        undefined,
        streaming ? (message) => displayed.push(message) : undefined,
      );
      assert.equal(
        turn.message,
        "We'll work on “Example Problem”. How would you like to approach it?",
      );
      assert.equal((turn.message.match(/\?/g) ?? []).length, 1);
      assert.equal(turn.stageId, definition.stages[0].id);
      assert.equal(turn.stageComplete, false);
      assert.deepEqual(turn.observations, []);
      assert.deepEqual(displayed, streaming ? [turn.message] : []);
      assert.deepEqual(context, before);
    }
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      generateInterviewResponseWithModel(model, context, controller.signal),
      { name: "AbortError" },
    );
  }
});
function fixture(count = 300) {
  const definition = loadDefinition("dsa");
  const problem = {
    id: "two-sum",
    interview: "dsa",
    content: "Use distinct indices; exactly one solution.",
  };
  const interview = startInterview(problem, { definition });
  interview.elapsedMs = 10_000;
  interview.messages = Array.from({ length: count }, (_, i) => ({
    id: `message-${i}`,
    role: i % 2 ? "candidate" : "interviewer",
    stage: "approach",
    content: `Turn ${i}: ${"reasoning ".repeat(100)}`,
  }));
  interview.observations = interview.messages
    .filter(({ role }) => role === "candidate")
    .map((message, i) => ({
      id: `observation-${i}`,
      stage: "approach",
      messageId: message.id,
      competencyId: definition.evaluation.competencies[i % 5].id,
      observation: `Evidence from ${message.id}`,
    }));
  return buildInterviewContext(interview, problem, definition, {
    type: "code",
    code: "current work",
    language: "java",
    filename: "Solution.java",
  });
}

test("long context is bounded, deterministic, grounded, and leaves full evaluation evidence intact", () => {
  const context = fixture();
  const original = structuredClone(context);
  const input = interviewerInput(context, "system", 24_000);
  assert.deepEqual(input, interviewerInput(context, "system", 24_000));
  assert.ok(input.diagnostics.inputCharacters <= 24_000);
  assert.ok(input.diagnostics.omittedMessages > 0);
  const data = JSON.parse(
    input.messages[0].content.split("\n").slice(1).join("\n"),
  );
  assert.ok(data.priorObservations.length <= 32);
  for (const observation of data.priorObservations)
    assert.ok(input.messageIds.includes(observation.messageId));
  assert.equal(
    input.messages.at(-1).content,
    context.interview.messages.at(-1).content,
  );
  assert.equal(data.problem.content, context.problem.content);
  assert.deepEqual(data.currentWorkspace, context.workspace);
  assert.deepEqual(context, original);
});

test("repeated observations are deduplicated and bounded without changing stored evidence", () => {
  const context = fixture(12);
  const observation = context.interview.observations[0];
  context.interview.observations = Array.from({ length: 1000 }, (_, i) => ({
    ...observation,
    id: `repeat-${i}`,
  }));
  const input = interviewerInput(context, "system");
  const data = JSON.parse(
    input.messages[0].content.slice(
      input.messages[0].content.indexOf("\n") + 1,
    ),
  );
  assert.equal(data.priorObservations.length, 1);
  assert.equal(input.diagnostics.omittedObservations, 999);
  assert.equal(context.interview.observations.length, 1000);
});

test("active-stage evidence is prioritized when older evidence groups exceed the observation cap", () => {
  const context = fixture(2);
  context.interview.stage.current = "wrap-up";
  context.interview.observations = Array.from({ length: 60 }, (_, i) => ({
    id: `observation-${i}`,
    stage: i === 59 ? "wrap-up" : `prior-stage-${i}`,
    competencyId: "problem-solving",
    observation: `Evidence ${i}`,
  }));
  const input = interviewerInput(context, "system");
  const data = JSON.parse(
    input.messages[0].content.slice(
      input.messages[0].content.indexOf("\n") + 1,
    ),
  );
  assert.equal(data.priorObservations.length, 32);
  assert.equal(data.priorObservations[0].stage, "wrap-up");
});

test("approved final closure ends the input with the engine task after historical candidate questions", () => {
  const context = fixture(2);
  context.interview.stage.current = "wrap-up";
  context.transition = { from: "wrap-up", to: null, reason: "time" };
  const input = interviewerInput(context, "system");
  const task = JSON.parse(
    input.messages.at(-1).content.split("\n").slice(1).join("\n"),
  );
  assert.equal(task.task, "closing");
  assert.equal(task.currentStageId, "wrap-up");
  assert.deepEqual(task.transition, context.transition);
  assert.ok(input.messageIds.includes(context.interview.messages.at(-1).id));
});

test("small budgets retain active stage, approved transition, workspace, and latest turn", () => {
  const context = fixture(30);
  context.interview.stage.current = "implementation";
  context.transition = {
    from: "approach",
    to: "implementation",
    reason: "ready",
  };
  const input = interviewerInput(context, "system", 5000);
  const data = JSON.parse(
    input.messages[0].content.slice(
      input.messages[0].content.indexOf("\n") + 1,
    ),
  );
  assert.equal(data.currentStage.current, "implementation");
  assert.deepEqual(data.transition, context.transition);
  assert.deepEqual(data.currentWorkspace, context.workspace);
  assert.ok(input.diagnostics.omittedMessages > 0);
  assert.ok(input.diagnostics.inputCharacters <= 5000);
});

test("oversized essential workspace, candidate turns, and evaluation evidence fail explicitly", () => {
  const context = fixture(2);
  context.workspace.code = "x".repeat(80_000);
  assert.throws(
    () => interviewerInput(context, "system"),
    /evidence was not truncated/,
  );
  context.workspace.code = "small";
  context.interview.messages.at(-1).content = "x".repeat(80_000);
  assert.throws(() => interviewerInput(context, "system"), /context budget/);
  assert.throws(
    () => assertContextBudget(300_000, 256_000),
    /evidence was not truncated/,
  );
  assert.throws(
    () => interviewerInput(fixture(2), "system", 100),
    /context budget/,
  );
});

test("production generation bounds the full request including structured-output reference IDs", async () => {
  const context = fixture(2000);
  context.workspace.code = "x".repeat(20_000);
  const previous = globalThis.fetch;
  globalThis.fetch = async (url) =>
    new Response(
      readFileSync(
        `content/prompts/${String(url).split("/").at(-1)}.md`,
        "utf8",
      ),
    );
  const model = new MockLanguageModelV3({
    doGenerate: async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            stageId: "approach",
            message: "How did you reason about the constraints?",
            stageComplete: false,
            observations: [],
          }),
        },
      ],
      finishReason: { unified: "stop", raw: "stop" },
      usage: { inputTokens: { total: 100 }, outputTokens: { total: 10 } },
    }),
  });
  try {
    await generateInterviewResponseWithModel(model, context);
    const request = model.doGenerateCalls[0];
    assert.ok(JSON.stringify(request).length < 64_000);
    const ids =
      request.responseFormat.schema.properties.observations.items.properties
        .messageId;
    assert.ok(JSON.stringify(ids).length < 10_000);
    assert.ok(JSON.stringify(request.prompt).includes("message-1999"));
  } finally {
    globalThis.fetch = previous;
  }
});
