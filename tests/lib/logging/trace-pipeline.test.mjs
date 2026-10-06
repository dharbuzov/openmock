import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import pino from "pino";
import { load } from "../../register-typescript.mjs";
import { loadDefinition } from "../../content-fixtures.mjs";

const { installLogger, wrapLogger, logger } = load(
  "../src/lib/logging/logger.ts",
);
const { createTurnContext } = load("../src/lib/logging/turn.ts");
const { LocalWhisper, LocalKokoro } = load("../src/lib/voice/local-speech.ts");
const { startInterview, acceptCandidateMessage } = load(
  "../src/lib/interview/engine.ts",
);
const { processCandidateMessage } = load("../src/lib/interview/runner.ts");
const { parseProblemDocument } = load("../src/lib/problems/schema.ts");
const { protectCredentials } = load("../src/lib/logging/sanitize.ts");
const problem = parseProblemDocument(
  readFileSync("content/problems/behavioral/conflict-with-teammate.md", "utf8"),
);
const definition = loadDefinition("behavioral");
const settings = {
  provider: "ollama",
  baseUrl: "http://localhost:11434",
  model: "qwen3:8b",
  interviewerVoiceEnabled: true,
};
const transcript =
  "I brought both engineers together and asked them to agree on a shared goal.";
const decision = {
  message: "What changed after you brought both engineers together?",
  stageComplete: true,
  observations: [],
};
const secret = "opaque-test-provider-key";

test("wire-body TRACE preserves complete textual error responses, hides credentials and leaves HTTP unchanged", async () => {
  const { loggedProviderFetch } = load("../src/lib/ai/logging.ts");
  const logs = [];
  const originalFetch = globalThis.fetch;
  const body = JSON.stringify({
    detail: "Full provider error ".repeat(600),
    echoedCredential: secret,
  });
  const input = {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, Cookie: "private-cookie" },
    body: JSON.stringify({ prompt: "Candidate input", apiKey: secret }),
  };
  globalThis.fetch = async (endpoint, init) => {
    assert.equal(endpoint, "https://provider.example/chat");
    assert.equal(init, input);
    return new Response(body, {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "private-cookie",
      },
    });
  };
  installLogger(
    wrapLogger(
      pino(
        { level: "trace" },
        { write: (line) => logs.push(JSON.parse(line)) },
      ),
    ),
  );
  try {
    const response = await loggedProviderFetch(
      { interviewId: "interview", turnId: "turn" },
      [secret],
    )("https://provider.example/chat", input);
    assert.equal(response.status, 401);
    assert.equal(await response.text(), body);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(
      logs.find((entry) => entry.msg === "HTTP_RESPONSE_BODY").body,
      body.replace(secret, "[REDACTED]"),
    );
    assert.ok(!JSON.stringify(logs).includes(secret));
    assert.ok(!JSON.stringify(logs).includes("private-cookie"));
  } finally {
    globalThis.fetch = originalFetch;
    installLogger(undefined);
  }
});

for (const streaming of [false, true])
  test(`one ${streaming ? "streamed" : "nonstreamed"} turn correlates STT, wire response, parsing, engine decisions and TTS without changing payloads`, async () => {
    const logs = [];
    const originalFetch = globalThis.fetch;
    const release = protectCredentials([secret]);
    installLogger(
      wrapLogger(
        pino(
          { level: "trace", base: { application: "openmock" } },
          { write: (line) => logs.push(JSON.parse(line)) },
        ),
      ),
    );
    let requestBody;
    globalThis.fetch = async (url, init) => {
      const endpoint = String(url);
      if (endpoint.startsWith("/api/prompts/"))
        return new Response(
          readFileSync(
            `content/prompts/${endpoint.split("/").at(-1)}.md`,
            "utf8",
          ),
        );
      if (endpoint.endsWith("/stt/transcribe")) {
        assert.ok(init.body instanceof FormData);
        return Response.json({
          text: transcript,
          language: "en",
          metadata: { confidence: 0.99 },
        });
      }
      if (endpoint.endsWith("/tts/synthesize")) {
        assert.deepEqual(JSON.parse(init.body), {
          text: decision.message,
          voice: "af_heart",
        });
        return new Response(new Uint8Array([82, 73, 70, 70, 0, 1, 2, 3]), {
          headers: { "content-type": "audio/wav" },
        });
      }
      assert.ok(endpoint.endsWith("/api/chat"));
      requestBody = JSON.parse(init.body);
      assert.equal(requestBody.stream, streaming);
      assert.ok(
        requestBody.messages.some((message) => message.content === transcript),
      );
      const body = {
        model: "qwen3:8b",
        created_at: "2026-10-06T12:00:00Z",
        done: true,
        message: { role: "assistant", content: JSON.stringify(decision) },
        done_reason: "stop",
        prompt_eval_count: 10,
        eval_count: 20,
      };
      if (streaming) {
        const text = JSON.stringify(decision);
        const chunks = [text.slice(0, 24), text.slice(24), ""];
        return new Response(
          chunks
            .map((content, index) =>
              JSON.stringify({
                ...body,
                done: index === 2,
                message: { role: "assistant", content },
              }),
            )
            .join("\n") + "\n",
          { headers: { "content-type": "application/x-ndjson" } },
        );
      }
      return Response.json(body);
    };
    try {
      const initial = startInterview(problem, { definition });
      const context = createTurnContext(initial.id);
      logger.debug(
        { ...context, component: "candidate-input", audioBytes: 8 },
        "CANDIDATE_AUDIO_INPUT",
      );
      const stt = await new LocalWhisper(
        "http://localhost:8001",
        context,
      ).transcribe(new Blob(["audio"], { type: "audio/webm" }));
      const interview = acceptCandidateMessage(initial, stt.text);
      logger.trace({ ...context, text: stt.text }, "CANDIDATE_INPUT");
      const partials = [];
      const updated = await processCandidateMessage(
        settings,
        interview,
        problem,
        definition,
        undefined,
        undefined,
        streaming ? (text) => partials.push(text) : undefined,
        false,
        context,
      );
      logger.trace(
        { ...context, interview: updated, response: updated.messages.at(-1) },
        "FRONTEND_RESPONSE",
      );
      const audio = await new LocalKokoro(
        "http://localhost:8001",
        context,
      ).synthesize(updated.messages.at(-1).content, { voice: "af_heart" });
      logger.info(
        {
          ...context,
          component: "interview-turn",
          durationMs: Math.round(performance.now() - context.startedAt),
        },
        "TURN_COMPLETED",
      );
      // Wire-body observations run independently of provider consumption.
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(audio.size, 8);
      assert.equal(stt.text, transcript);
      assert.equal(updated.messages.at(-1).content, decision.message);
      if (streaming) assert.equal(partials.at(-1), decision.message);
      const events = [
        "STT_REQUEST",
        "STT_RESPONSE",
        "CANDIDATE_INPUT",
        "INTERVIEW_STATE_BEFORE",
        "LLM_REQUEST",
        "HTTP_REQUEST_BODY",
        "HTTP_RESPONSE_BODY",
        "LLM_RAW_RESPONSE",
        "LLM_PARSED_RESPONSE",
        "PARSE_COMPLETED",
        "INTERVIEW_DECISION",
        "INTERVIEW_STATE_AFTER",
        "STAGE_TRANSITION",
        "FRONTEND_RESPONSE",
        "TTS_REQUEST",
        "TTS_RESPONSE",
        "TURN_COMPLETED",
      ];
      for (const event of events) {
        const entries = logs.filter((entry) => entry.msg === event);
        assert.ok(entries.length, event);
        assert.ok(
          entries.every(
            (entry) =>
              entry.turnId === context.turnId &&
              entry.interviewId === initial.id,
          ),
          event,
        );
      }
      assert.deepEqual(
        JSON.parse(
          logs.find((entry) => entry.msg === "HTTP_REQUEST_BODY").body,
        ),
        requestBody,
      );
      assert.deepEqual(
        logs.find((entry) => entry.msg === "LLM_PARSED_RESPONSE").parsed,
        decision,
      );
      assert.equal(
        logs.find((entry) => entry.msg === "STT_RESPONSE").result.metadata
          .confidence,
        0.99,
      );
      assert.equal(
        logs.find((entry) => entry.msg === "TTS_REQUEST").text,
        decision.message,
      );
      assert.equal(
        logs.find((entry) => entry.msg === "TTS_RESPONSE").audioBytes,
        8,
      );
      assert.ok(!JSON.stringify(logs).includes("audio/webm;base64"));
      if (!streaming && process.env.OPENMOCK_TRACE_EXAMPLE_FILE)
        writeFileSync(
          process.env.OPENMOCK_TRACE_EXAMPLE_FILE,
          logs.map((entry) => JSON.stringify(entry)).join("\n") + "\n",
        );
    } finally {
      globalThis.fetch = originalFetch;
      release();
      installLogger(undefined);
    }
  });

test("TRACE retains full parsing failures and secrets stay redacted; broken logging cannot fail generation", async () => {
  const { loggedGenerateText } = load("../src/lib/ai/logging.ts");
  const { MockLanguageModelV3 } = await import("ai/test");
  const { Output } = await import("ai");
  const { z } = await import("zod");
  const logs = [];
  const release = protectCredentials([secret]);
  const response = {
    content: [
      { type: "text", text: `invalid ${secret} ${"diagnostic ".repeat(2000)}` },
    ],
    finishReason: { unified: "stop", raw: "stop" },
    usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } },
    warnings: [],
  };
  installLogger(
    wrapLogger(
      pino(
        { level: "trace" },
        { write: (line) => logs.push(JSON.parse(line)) },
      ),
    ),
  );
  try {
    await assert.rejects(
      loggedGenerateText({ interviewId: "interview", turnId: "turn" })({
        model: new MockLanguageModelV3({ doGenerate: async () => response }),
        prompt: "Full prompt",
        output: Output.object({ schema: z.object({ message: z.string() }) }),
        maxRetries: 0,
      }),
    );
    assert.equal(
      logs.find((entry) => entry.msg === "LLM_RAW_RESPONSE").response.content[0]
        .text,
      response.content[0].text.replace(secret, "[REDACTED]"),
    );
    assert.equal(
      logs.find((entry) => entry.msg === "LLM_PARSE_ERROR").text,
      response.content[0].text.replace(secret, "[REDACTED]"),
    );
    assert.ok(!JSON.stringify(logs).includes(secret));
    logs.length = 0;
    installLogger(
      wrapLogger(
        pino(
          { level: "debug" },
          { write: (line) => logs.push(JSON.parse(line)) },
        ),
      ),
    );
    await loggedGenerateText({ interviewId: "interview", turnId: "turn" })({
      model: new MockLanguageModelV3({ doGenerate: async () => response }),
      prompt: "Private prompt content",
      maxRetries: 0,
    });
    assert.ok(logs.some((entry) => entry.msg === "LLM_COMPLETED"));
    assert.ok(!JSON.stringify(logs).includes("Private prompt content"));
    assert.ok(!JSON.stringify(logs).includes("diagnostic diagnostic"));
    installLogger(
      wrapLogger(
        pino(
          { level: "trace" },
          {
            write() {
              throw new Error("Unavailable sink");
            },
          },
        ),
      ),
    );
    const result = await loggedGenerateText({ turnId: "turn" })({
      model: new MockLanguageModelV3({ doGenerate: async () => response }),
      prompt: "Full prompt",
      maxRetries: 0,
    });
    assert.equal(result.text, response.content[0].text);
  } finally {
    release();
    installLogger(undefined);
  }
});
