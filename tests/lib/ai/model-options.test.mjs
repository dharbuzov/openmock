import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateText, Output } from "ai";
import { z } from "zod";
import pino from "pino";
import { load } from "../../register-typescript.mjs";
import { loadDefinition } from "../../content-fixtures.mjs";

const { getLanguageModel } = load("../src/lib/ai/model.ts");
const { generateInterviewResponse } = load("../src/lib/ai/provider.ts");
const { evaluateInterview } = load("../src/lib/ai/evaluation.ts");
const { startInterview, acceptCandidateMessage, buildInterviewContext } = load(
  "../src/lib/interview/engine.ts",
);
const { installLogger, wrapLogger } = load("../src/lib/logging/logger.ts");

test("production Ollama interviewer and evaluator send think:false and retain JSON schemas", async () => {
  const previous = globalThis.fetch;
  const bodies = [];
  const logs = [];
  installLogger(
    wrapLogger(
      pino(
        { level: "debug" },
        { write: (line) => logs.push(JSON.parse(line)) },
      ),
    ),
  );
  const definition = loadDefinition("dsa");
  const problem = { id: "two-sum", interview: "dsa" };
  const interview = acceptCandidateMessage(
    startInterview(problem, { definition }),
    "I use a map.",
  );
  const context = buildInterviewContext(interview, problem, definition);
  const evaluation = {
    recommendation: "mixed",
    summary: "Limited evidence.",
    finalAssessment: "Depth is unassessed.",
    strengths: [],
    concerns: [],
    keyMoments: [],
    competencies: definition.evaluation.competencies.map(({ id }, i) => ({
      competencyId: id,
      rating: i ? "not-assessed" : "positive",
      summary: i ? "No opportunity." : "Explained a map.",
      expectation: null,
      evidence: i
        ? []
        : [
            {
              observation: "Used a map.",
              messageId: interview.messages[0].id,
              stage: "approach",
            },
          ],
    })),
  };
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith("/api/prompts/"))
      return new Response(
        readFileSync(
          `content/prompts/${String(url).split("/").at(-1)}.md`,
          "utf8",
        ),
      );
    const body = JSON.parse(init.body);
    bodies.push(body);
    const value = body.format.properties.stageId
      ? {
          stageId: "approach",
          message: "How would you use the map?",
          stageComplete: false,
          observations: [],
        }
      : evaluation;
    const response = {
      model: "qwen3:8b",
      created_at: new Date().toISOString(),
      message: { role: "assistant", content: JSON.stringify(value) },
      done: true,
      done_reason: "stop",
      prompt_eval_count: 100,
      eval_count: 50,
    };
    return body.stream
      ? new Response(JSON.stringify(response) + "\n", {
          headers: { "content-type": "application/x-ndjson" },
        })
      : Response.json(response);
  };
  try {
    const settings = {
      provider: "ollama",
      model: "qwen3:8b",
      baseUrl: "http://localhost:11434",
    };
    await generateInterviewResponse(settings, context);
    await evaluateInterview(settings, context);
    const displayed = [];
    await generateInterviewResponse(settings, context, undefined, (message) =>
      displayed.push(message),
    );
    assert.ok(displayed.length);
    assert.equal(bodies.length, 3);
    assert.equal(
      Object.keys(bodies[1].format.properties).at(-1),
      "recommendation",
    );
    assert.equal(bodies.at(-1).stream, true);
    for (const body of bodies) {
      assert.equal(body.think, false);
      assert.equal(body.format.type, "object");
      assert.equal(body.options, undefined);
      assert.equal(body.temperature, undefined);
      assert.equal(body.top_p, undefined);
    }
    assert.equal(
      logs.filter(({ msg }) => msg === "LLM_CONTEXT_SIZE").length,
      3,
    );
    assert.ok(logs.some(({ usage }) => usage?.inputTokens === 100));
    assert.ok(
      logs.every(
        ({ estimatedInputTokens }) =>
          estimatedInputTokens === undefined || estimatedInputTokens > 0,
      ),
    );
  } finally {
    globalThis.fetch = previous;
    installLogger(undefined);
  }
});

test("OpenAI and Anthropic structured requests have no Ollama options", async () => {
  const previous = globalThis.fetch;
  try {
    for (const provider of ["openai", "anthropic"]) {
      let body;
      globalThis.fetch = async (_url, init) => {
        body = JSON.parse(init.body);
        throw new Error("captured request");
      };
      await assert.rejects(
        generateText({
          model: getLanguageModel({
            provider,
            model: provider === "openai" ? "gpt-4.1-mini" : "claude-sonnet-4-5",
            apiKey: "test-key",
          }),
          prompt: "Return OK.",
          output: Output.object({ schema: z.object({ message: z.string() }) }),
          maxOutputTokens: 100,
          maxRetries: 0,
        }),
        /captured request/,
      );
      assert.ok(body);
      assert.equal(body.think, undefined);
      assert.equal(body.ollama, undefined);
      assert.equal(body.options, undefined);
    }
  } finally {
    globalThis.fetch = previous;
  }
});
