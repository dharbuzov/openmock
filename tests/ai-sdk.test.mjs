import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MockLanguageModelV3 } from "ai/test";
import { load } from "./register-typescript.mjs";
import { loadDefinition } from "./content-fixtures.mjs";

const { startInterview, acceptCandidateMessage } = load(
  "../src/lib/interview/engine.ts",
);
const { generateInterviewResponseWithModel, AIProviderError } = load(
  "../src/lib/ai/provider.ts",
);
const { evaluateInterviewWithModel } = load("../src/lib/ai/evaluation.ts");
const { normalizeExcalidrawScene } = load(
  "../src/lib/diagram/normalize-excalidraw.ts",
);
const { captureWorkspaceSnapshot } = load("../src/lib/interview/workspace.ts");

const mockResult = (text) => ({
  content: [{ type: "text", text }],
  finishReason: { unified: "stop", raw: "stop" },
  usage: {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
  },
});
const problem = {
  id: "two-sum",
  title: "Two Sum",
  interview: "dsa",
  difficulty: "easy",
  categories: ["algorithms"],
  topics: ["hash-map"],
  companies: [],

  content: "Return matching indices.",
  interviewerContext: "Probe duplicate values.",
  language: "java",
  starterCode: "class Solution {}",
};
const definition = loadDefinition("dsa");
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const match = /^\/api\/prompts\/(interviewer|evaluator)$/.exec(String(url));
  if (!match) return originalFetch(url);
  return new Response(
    readFileSync(
      new URL(`../content/prompts/${match[1]}.md`, import.meta.url),
      "utf8",
    ),
  );
};
test.after(() => {
  globalThis.fetch = originalFetch;
});

test("provider returns the shared structured InterviewTurn model", async () => {
  const interview = acceptCandidateMessage(
    startInterview(problem, {
      definition,
      targetLevel: "senior",
      mode: "practice",
    }),
    "I will use a hash map.",
  );
  const output = {
    message: "What are the complexity costs?",
    stageComplete: true,
    observations: [
      {
        id: "obs-1",
        competencyId: "problem-solving",
        observation: "Candidate selected a hash map.",
        messageId: interview.messages[0].id,
      },
    ],
  };
  const model = new MockLanguageModelV3({
    doGenerate: mockResult(JSON.stringify(output)),
  });
  const turn = await generateInterviewResponseWithModel(model, {
    interview,
    problem,
    definition,
    workspace: {
      type: "code",
      language: "Java",
      filename: "Solution.java",
      code: "class Solution {}",
    },
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
    id: "url-shortener",
    title: "URL Shortener",
    interview: "system-design",
    difficulty: "easy",
    categories: [],
    topics: [],
    companies: [],

    content: "Design a shortener.",
  };
  const interview = acceptCandidateMessage(
    startInterview(systemProblem, {
      definition: systemDefinition,
      targetLevel: "staff",
      mode: "mock",
    }),
    "I will place a cache before the database.",
  );
  const output = {
    message: "What happens if the cache fails?",
    stageComplete: false,
    observations: [],
  };
  const model = new MockLanguageModelV3({
    doGenerate: mockResult(JSON.stringify(output)),
  });
  const workspace = captureWorkspaceSnapshot("diagram", {
    code: () => undefined,
    diagram: () =>
      normalizeExcalidrawScene([
        { id: "cache", type: "rectangle", x: 0, y: 0, width: 100, height: 80 },
        {
          id: "cache-label",
          type: "text",
          text: "Redis",
          containerId: "cache",
        },
        { id: "db", type: "ellipse", x: 200, y: 0, width: 100, height: 80 },
        {
          id: "arrow",
          type: "arrow",
          startBinding: { elementId: "cache" },
          endBinding: { elementId: "db" },
        },
        {
          id: "note",
          type: "text",
          text: "TTL: 30s\nInvalidate on writes",
          x: 0,
          y: 150,
          width: 200,
          height: 40,
        },
      ]),
  });
  const context = {
    interview,
    problem: systemProblem,
    definition: systemDefinition,
    workspace,
  };
  await generateInterviewResponseWithModel(model, context);
  const prompt = JSON.stringify(model.doGenerateCalls[0].prompt);
  assert.match(prompt, /System Design Interview/);
  assert.match(prompt, /Redis/);
  assert.match(prompt, /cache before the database/);
  const evaluator = new MockLanguageModelV3({
    doGenerate: mockResult(
      JSON.stringify({
        recommendation: "no-hire",
        competencies: systemDefinition.evaluation.competencies.map(
          ({ id }) => ({
            competencyId: id,
            rating: "not-demonstrated",
            summary: "No evidence.",
            evidence: [],
          }),
        ),
        strengths: [],
        concerns: [],
        keyMoments: [],
        summary: "Limited evidence.",
        finalAssessment: "Further discussion needed.",
      }),
    ),
  });
  await evaluateInterviewWithModel(evaluator, context);
  for (const [calls, prefix] of [
    [model.doGenerateCalls, "Interview context (data):\n"],
    [evaluator.doGenerateCalls, "Interview evidence (data):\n"],
  ]) {
    const data = calls[0].prompt
      .flatMap((message) =>
        Array.isArray(message.content) ? message.content : [],
      )
      .find((part) => part.type === "text" && part.text.startsWith(prefix));
    assert.deepEqual(
      JSON.parse(data.text.slice(prefix.length)).currentWorkspace,
      workspace,
    );
  }
});

test("provider failures remain safe", async () => {
  const interview = acceptCandidateMessage(
    startInterview(problem, {
      definition,
      targetLevel: "senior",
      mode: "practice",
    }),
    "Hello",
  );
  const model = new MockLanguageModelV3({
    doGenerate: async () => {
      throw new Error("secret");
    },
  });
  await assert.rejects(
    generateInterviewResponseWithModel(model, {
      interview,
      problem,
      definition,
      workspace: {
        type: "code",
        language: "Java",
        filename: "Solution.java",
        code: "",
      },
    }),
    (error) =>
      error instanceof AIProviderError && !error.message.includes("secret"),
  );
});

test("evaluation is qualitative, holistic, and preserves not-assessed", async () => {
  const interview = acceptCandidateMessage(
    startInterview(problem, {
      definition,
      targetLevel: "senior",
      mode: "practice",
    }),
    "I will use a hash map.",
  );
  const competencies = definition.evaluation.competencies.map(({ id }) => ({
    competencyId: id,
    rating: id === "trade-offs" ? "not-assessed" : "positive",
    summary: id === "trade-offs" ? "No evidence." : "Grounded evidence.",
    evidence:
      id === "trade-offs"
        ? []
        : [
            {
              observation: "Candidate selected a hash map.",
              messageId: interview.messages[0].id,
              stage: "approach",
            },
          ],
  }));
  const output = {
    recommendation: "hire",
    competencies,
    strengths: [
      {
        observation: "Selected an efficient lookup structure.",
        messageId: interview.messages[0].id,
        stage: "approach",
      },
    ],
    concerns: [],
    keyMoments: [],
    summary: "A promising start.",
    finalAssessment: "The evidence supports a hire recommendation.",
  };
  const model = new MockLanguageModelV3({
    doGenerate: mockResult(JSON.stringify(output)),
  });
  const result = await evaluateInterviewWithModel(model, {
    interview,
    problem,
    definition,
    workspace: {
      type: "code",
      language: "Java",
      filename: "Solution.java",
      code: "class Solution {}",
    },
  });
  assert.equal(result.recommendation, "hire");
  assert.equal(result.competencies.at(-1).rating, "not-assessed");
  assert.equal("score" in result, false);
  assert.equal(result.interviewId, interview.id);
});

test("generic evaluator accepts competencies loaded from the behavioral definition", async () => {
  const behavioralDefinition = loadDefinition("behavioral");
  const behavioralProblem = {
    id: "conflict-with-teammate",
    title: "Conflict",
    interview: "behavioral",
    difficulty: "medium",
    categories: [],
    topics: [],
    companies: [],

    content: "Tell me about a conflict.",
    interviewerContext: "Probe the candidate's contribution.",
  };
  const interview = acceptCandidateMessage(
    startInterview(behavioralProblem, {
      definition: behavioralDefinition,
      targetLevel: "staff",
      mode: "mock",
    }),
    "I brought both engineers together and clarified the shared goal.",
  );
  const output = {
    recommendation: "hire",
    competencies: behavioralDefinition.evaluation.competencies.map(
      ({ id }) => ({
        competencyId: id,
        rating: id === "collaboration" ? "positive" : "not-assessed",
        summary:
          id === "collaboration"
            ? "Demonstrated collaboration."
            : "Not enough evidence.",
        evidence:
          id === "collaboration"
            ? [
                {
                  observation: "Brought both engineers together.",
                  messageId: interview.messages[0].id,
                  stage: "introduction",
                },
              ]
            : [],
      }),
    ),
    strengths: [
      {
        observation: "Clarified a shared goal.",
        messageId: interview.messages[0].id,
      },
    ],
    concerns: [],
    keyMoments: [],
    summary: "Evidence of collaboration.",
    finalAssessment: "The available evidence supports hire.",
  };
  const model = new MockLanguageModelV3({
    doGenerate: mockResult(JSON.stringify(output)),
  });
  const result = await evaluateInterviewWithModel(model, {
    interview,
    problem: behavioralProblem,
    definition: behavioralDefinition,
    workspace: { type: "none" },
  });
  assert.equal(
    result.competencies.length,
    behavioralDefinition.evaluation.competencies.length,
  );
  assert.equal(
    result.competencies.find(
      ({ competencyId }) => competencyId === "collaboration",
    ).rating,
    "positive",
  );
});

test("evaluation parse and schema failures preserve causes and safe diagnostics", async () => {
  const { EvaluationError } = load("../src/lib/ai/evaluation.ts");
  const { installLogger, wrapLogger } = load("../src/lib/logging/logger.ts");
  const pino = (await import("pino")).default;
  const logs = [];
  installLogger(
    wrapLogger(
      pino(
        { level: "debug" },
        { write: (line) => logs.push(JSON.parse(line)) },
      ),
    ),
  );
  try {
    const interview = startInterview(problem, { definition });
    for (const text of [
      "INVALID sk-THIS_MUST_NEVER_APPEAR",
      JSON.stringify({ summary: "private model response" }),
    ]) {
      logs.length = 0;
      await assert.rejects(
        evaluateInterviewWithModel(
          new MockLanguageModelV3({ doGenerate: mockResult(text) }),
          {
            interview,
            problem,
            definition,
            workspace: {
              type: "code",
              language: "Java",
              filename: "Solution.java",
              code: "",
            },
          },
        ),
        (error) =>
          error instanceof EvaluationError && error.cause !== undefined,
      );
      const failure = logs.find((entry) => entry.msg === "Evaluation failed");
      assert.equal(failure.interviewId, interview.id);
      assert.equal(failure.responseReceived, true);
      assert.equal(failure.responseLength, text.length);
      assert.equal(failure.validationSucceeded, false);
      assert.equal(failure.parseSucceeded, text.startsWith("{"));
      assert.ok(failure.err.cause);
      if (text.startsWith("{")) assert.ok(failure.validationIssues.length > 0);
      const serialized = JSON.stringify(logs);
      assert.ok(!serialized.includes("sk-THIS_MUST_NEVER_APPEAR"));
      if (text.startsWith("{"))
        assert.ok(serialized.includes("private model response"));
      const request = logs.find((entry) => entry.msg === "AI request");
      const response = logs.find((entry) => entry.msg === "AI response");
      assert.equal(request.requestId, response.requestId);
      assert.ok(request.request.system);
      assert.ok(request.request.providerRequest.prompt.length > 0);
      assert.equal(
        response.response.content[0].text,
        text.startsWith("{") ? text : "INVALID [REDACTED]",
      );
    }
  } finally {
    installLogger(wrapLogger(pino({ level: "info" })));
  }
});

test("shared AI boundary logs full successful payloads and correlates provider failures", async () => {
  const { loggedGenerateText } = load("../src/lib/ai/logging.ts");
  const { installLogger, wrapLogger } = load("../src/lib/logging/logger.ts");
  const { protectCredentials } = load("../src/lib/logging/sanitize.ts");
  const pino = (await import("pino")).default;
  const logs = [];
  const credential = "opaque-credential-value";
  const release = protectCredentials([credential]);
  installLogger(
    wrapLogger(
      pino(
        { level: "debug" },
        { write: (line) => logs.push(JSON.parse(line)) },
      ),
    ),
  );
  try {
    const system = "System instructions ".repeat(800);
    const content = "User workspace content " + credential;
    const model = new MockLanguageModelV3({
      doGenerate: mockResult("Complete response " + credential),
    });
    const result = await loggedGenerateText({
      provider: "mock",
      model: "mock-model",
      operation: "connection-test",
    })({
      model,
      system,
      messages: [{ role: "user", content }],
      maxRetries: 0,
    });
    const request = logs.find((entry) => entry.msg === "AI request");
    const response = logs.find((entry) => entry.msg === "AI response");
    assert.equal(request.request.system, system);
    assert.equal(
      request.request.messages[0].content,
      "User workspace content [REDACTED]",
    );
    assert.equal(request.requestId, response.requestId);
    assert.equal(
      response.response.content[0].text,
      "Complete response [REDACTED]",
    );
    assert.ok(response.durationMs >= 0);
    assert.ok(result.text.includes(credential));
    assert.ok(
      model.doGenerateCalls[0].prompt.some((message) =>
        JSON.stringify(message).includes(credential),
      ),
    );
    assert.ok(!JSON.stringify(logs).includes(credential));

    for (const level of ["debug", "info"]) {
      logs.length = 0;
      installLogger(
        wrapLogger(
          pino({ level }, { write: (line) => logs.push(JSON.parse(line)) }),
        ),
      );
      const failing = new MockLanguageModelV3({
        doGenerate: async () => {
          throw new Error("Provider unavailable");
        },
      });
      await assert.rejects(
        loggedGenerateText({
          operation: "interviewer-turn",
          interviewId: "abc",
        })({
          model: failing,
          system,
          prompt: "User prompt",
          maxRetries: 0,
        }),
        /Provider unavailable/,
      );
      const failure = logs.find((entry) => entry.msg === "AI request failed");
      assert.equal(failure.err.message, "Provider unavailable");
      assert.equal("request" in failure, level === "debug");
      if (level === "debug")
        assert.equal(
          logs.find((entry) => entry.msg === "AI request").requestId,
          failure.requestId,
        );
    }
  } finally {
    release();
    installLogger(wrapLogger(pino({ level: "info" })));
  }
});

test("evaluation constrains competency IDs and count to each definition rubric", async () => {
  const { completeInterview } = load("../src/lib/interview/engine.ts");
  for (const id of ["system-design", "dsa", "behavioral"]) {
    const rubric = loadDefinition(id);
    const currentProblem = { ...problem, interview: id };
    const interview = completeInterview(
      startInterview(currentProblem, { definition: rubric }),
    );
    const output = {
      recommendation: "no-hire",
      competencies: rubric.evaluation.competencies.map(({ id }) => ({
        competencyId: id,
        rating: "not-demonstrated",
        summary: "No evidence was supplied.",
        evidence: [],
      })),
      strengths: [],
      concerns: [],
      keyMoments: [],
      summary: "Insufficient evidence.",
      finalAssessment: "Further assessment is required.",
    };
    const context = {
      interview,
      problem: currentProblem,
      definition: rubric,
      workspace: load("../src/lib/interview/engine.ts").emptyWorkspaceSnapshot(
        rubric.workspace,
      ),
    };
    const model = new MockLanguageModelV3({
      doGenerate: mockResult(JSON.stringify(output)),
    });
    const result = await evaluateInterviewWithModel(model, context);
    assert.equal(
      result.competencies.length,
      rubric.evaluation.competencies.length,
    );
    assert.equal(interview.stage.current, null);
    const schema = model.doGenerateCalls[0].responseFormat.schema;
    assert.deepEqual(
      schema.properties.competencies.items.properties.competencyId.enum,
      rubric.evaluation.competencies.map(({ id }) => id),
    );
    assert.equal(
      schema.properties.competencies.minItems,
      rubric.evaluation.competencies.length,
    );
    assert.equal(
      schema.properties.competencies.maxItems,
      rubric.evaluation.competencies.length,
    );
    for (const competencies of [
      output.competencies.slice(1),
      output.competencies.map((item, index) =>
        index === 0 ? { ...item, competencyId: "invented-id" } : item,
      ),
      output.competencies.map((item, index) =>
        index === 0 ? output.competencies[1] : item,
      ),
    ]) {
      await assert.rejects(
        evaluateInterviewWithModel(
          new MockLanguageModelV3({
            doGenerate: mockResult(JSON.stringify({ ...output, competencies })),
          }),
          context,
        ),
      );
    }
  }
});

test("evaluation constrains every evidence message reference to the supplied transcript", async () => {
  const { completeInterview, emptyWorkspaceSnapshot } = load(
    "../src/lib/interview/engine.ts",
  );
  for (const hasMessages of [true, false]) {
    const initial = startInterview(problem, { definition });
    const interview = completeInterview(
      hasMessages ? acceptCandidateMessage(initial, "I am finished.") : initial,
    );
    const output = {
      recommendation: "no-hire",
      competencies: definition.evaluation.competencies.map(({ id }) => ({
        competencyId: id,
        rating: "not-demonstrated",
        summary: "Expected evidence was absent.",
        evidence: [],
      })),
      strengths: [],
      concerns: [],
      keyMoments: [],
      summary: "No substantive work was demonstrated.",
      finalAssessment: "Expected work was absent.",
    };
    const context = {
      interview,
      definition,
      problem,
      workspace: emptyWorkspaceSnapshot(definition.workspace),
    };
    const model = new MockLanguageModelV3({
      doGenerate: mockResult(JSON.stringify(output)),
    });
    await evaluateInterviewWithModel(model, context);
    const properties =
      model.doGenerateCalls[0].responseFormat.schema.properties;
    for (const schema of [
      properties.strengths.items,
      properties.concerns.items,
      properties.keyMoments.items,
      properties.competencies.items.properties.evidence.items,
    ]) {
      if (hasMessages)
        assert.deepEqual(
          schema.properties.messageId.enum,
          interview.messages.map(({ id }) => id),
        );
      else assert.equal(schema.properties.messageId, undefined);
    }
    if (hasMessages) {
      for (const field of [
        "strengths",
        "concerns",
        "keyMoments",
        "competencies",
      ]) {
        const evidence = [
          {
            observation: "Candidate ended the interview.",
            messageId: "invented-message-id",
          },
        ];
        const invalid =
          field === "competencies"
            ? {
                ...output,
                competencies: output.competencies.map((item, i) =>
                  i ? item : { ...item, evidence },
                ),
              }
            : { ...output, [field]: evidence };
        await assert.rejects(
          evaluateInterviewWithModel(
            new MockLanguageModelV3({
              doGenerate: mockResult(JSON.stringify(invalid)),
            }),
            context,
          ),
        );
      }
      const valid = {
        ...output,
        concerns: [
          {
            observation: "Candidate ended the interview.",
            messageId: interview.messages[0].id,
          },
        ],
      };
      const result = await evaluateInterviewWithModel(
        new MockLanguageModelV3({
          doGenerate: mockResult(JSON.stringify(valid)),
        }),
        context,
      );
      assert.equal(result.concerns[0].messageId, interview.messages[0].id);
    }
  }
});
function streamModel(deltas, ending = "finish") {
  return new MockLanguageModelV3({
    doStream: {
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "stream-start", warnings: [] });
          controller.enqueue({ type: "text-start", id: "text" });
          for (const delta of deltas)
            controller.enqueue({ type: "text-delta", id: "text", delta });
          if (ending === "error")
            controller.enqueue({
              type: "error",
              error: Error("connection interrupted"),
            });
          else {
            controller.enqueue({ type: "text-end", id: "text" });
            controller.enqueue({
              type: "finish",
              finishReason: mockResult("").finishReason,
              usage: mockResult("").usage,
            });
          }
          controller.close();
        },
      }),
    },
  });
}
function streamingContext() {
  return {
    interview: acceptCandidateMessage(
      startInterview(problem, { definition }),
      "I would use a map.",
    ),
    problem,
    definition,
    workspace: {
      type: "code",
      language: "java",
      filename: "Solution.java",
      code: "",
    },
  };
}

test("real structured streaming exposes message text and waits for the validated final turn", async () => {
  const updates = [];
  const context = streamingContext();
  const model = streamModel([
    '{"message":"What',
    " constraints matter?",
    '","stageComplete":false,"observations":[]}',
  ]);
  const turn = await generateInterviewResponseWithModel(
    model,
    context,
    undefined,
    (text) => updates.push(text),
  );
  assert.ok(updates.length >= 2);
  assert.equal(updates[0], "What");
  assert.equal(updates.at(-1), "What constraints matter?");
  assert.deepEqual(turn, {
    message: "What constraints matter?",
    stageComplete: false,
    observations: [],
  });
  assert.equal(context.interview.messages.length, 1);
  assert.equal(model.doGenerateCalls.length, 0);
});

test("streaming provider failures and invalid final output never become interviewer turns", async () => {
  for (const model of [
    streamModel(['{"message":"Partial'], "error"),
    streamModel([
      '{"message":"Partial","stageComplete":"yes","observations":[]}',
    ]),
  ]) {
    const context = streamingContext();
    await assert.rejects(
      generateInterviewResponseWithModel(model, context, undefined, () => {}),
      AIProviderError,
    );
    assert.equal(context.interview.messages.length, 1);
    assert.equal(context.interview.stage.current, definition.stages[0].id);
  }
});

test("a model without streaming returns a complete validated response without synthetic chunks", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: mockResult(
      '{"message":"Complete reply","stageComplete":false,"observations":[]}',
    ),
  });
  model.doStream = undefined;
  const updates = [];
  const turn = await generateInterviewResponseWithModel(
    model,
    streamingContext(),
    undefined,
    (text) => updates.push(text),
  );
  assert.equal(turn.message, "Complete reply");
  assert.deepEqual(updates, []);
  assert.equal(model.doGenerateCalls.length, 1);
});
