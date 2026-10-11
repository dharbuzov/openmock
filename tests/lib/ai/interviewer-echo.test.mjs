import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import pino from "pino";
import { load, storage } from "../../register-typescript.mjs";
import { loadDefinition } from "../../content-fixtures.mjs";

const { startInterview, acceptCandidateMessage, applyInterviewTurn } = load(
  "../src/lib/interview/engine.ts",
);
const { processCandidateMessage } = load("../src/lib/interview/runner.ts");
const { installLogger, wrapLogger } = load("../src/lib/logging/logger.ts");
const { saveInterviewSession, readInterviewSession } = load(
  "../src/lib/interview/session-storage.ts",
);
const definition = loadDefinition("dsa");
const problem = {
  id: "two-sum",
  title: "Two Sum",
  interview: "dsa",
  difficulty: "easy",
  categories: [],
  topics: [],
  companies: [],
  content: "Return the indices of two distinct elements whose sum is target.",
};
const candidate = `Sure. I'd start with a straightforward brute-force approach.

We could iterate through the array using two nested loops, checking each pair of distinct elements to see whether their sum equals the target.

This would give us O(n²) time complexity and O(1) extra space.

However, I think we can optimize the lookup using additional memory.

Would you like me to explore that optimization before moving to implementation?`;
const followUp =
  "Your brute-force approach checks all distinct pairs. Yes, explore the optimization: how would the additional memory reduce lookup time?";

// An injected provider echo establishes which boundary owns the text. A proper
// reply then proves handling never substitutes the candidate's question for it.
for (const streaming of [false, true]) {
  for (const echo of [true, false]) {
    test(`Two Sum ${streaming ? "streamed" : "generated"} ${echo ? "provider echo is traceable" : "follow-up survives parsing and persistence"}`, async () => {
      const logs = [];
      const originalFetch = globalThis.fetch;
      const originalWindow = globalThis.window;
      globalThis.window = { sessionStorage: storage() };
      installLogger(
        wrapLogger(
          pino(
            { level: "trace" },
            { write: (line) => logs.push(JSON.parse(line)) },
          ),
        ),
      );
      const decision = {
        stageId: "approach",
        message: echo ? candidate.replace(/\s+/g, " ") : followUp,
        stageComplete: false,
        observations: [],
      };
      let request;
      globalThis.fetch = async (url, init) => {
        if (String(url).startsWith("/api/prompts/"))
          return new Response(
            readFileSync(
              `content/prompts/${String(url).split("/").at(-1)}.md`,
              "utf8",
            ),
          );
        assert.ok(String(url).endsWith("/api/chat"));
        request = JSON.parse(init.body);
        const body = {
          model: "test-model",
          created_at: "2026-10-11T12:00:00Z",
          done: true,
          message: { role: "assistant", content: JSON.stringify(decision) },
          done_reason: "stop",
          prompt_eval_count: 10,
          eval_count: 20,
        };
        return new Response(JSON.stringify(body) + (streaming ? "\n" : ""), {
          headers: {
            "content-type": streaming
              ? "application/x-ndjson"
              : "application/json",
          },
        });
      };
      try {
        const opening = applyInterviewTurn(
          startInterview(problem, { definition }),
          definition,
          {
            stageId: "approach",
            message: "How would you approach this problem?",
            stageComplete: false,
            observations: [],
          },
        );
        const interview = acceptCandidateMessage(opening, candidate);
        const displayed = [];
        const updated = await processCandidateMessage(
          {
            provider: "ollama",
            model: "test-model",
            baseUrl: "http://localhost:11434",
          },
          interview,
          problem,
          definition,
          undefined,
          undefined,
          streaming ? (message) => displayed.push(message) : undefined,
          false,
          undefined,
          (committed) => saveInterviewSession({ interview: committed }),
        );
        assert.equal(request.stream, streaming);
        assert.deepEqual(
          request.messages.map(({ role }) => role),
          ["system", "user", "assistant", "user"],
        );
        assert.equal(request.messages.at(-1).content, candidate);
        assert.equal(
          request.messages.at(-2).content,
          opening.messages[0].content,
        );
        const system = request.messages[0].content;
        assert.match(
          system,
          /output `message` is your\s+reply to the candidate/,
        );
        assert.match(system, /candidate asks a question/);
        assert.ok(system.includes(definition.instructions));
        const data = JSON.parse(
          request.messages[1].content.split("\n").slice(1).join("\n"),
        );
        assert.equal(data.currentStage.current, "approach");
        assert.deepEqual(data.interviewDefinition.stages, definition.stages);
        assert.equal(updated.stage.current, "approach");
        assert.equal(updated.messages.at(-2).role, "candidate");
        assert.equal(updated.messages.at(-2).content, candidate);
        assert.equal(updated.messages.at(-1).role, "interviewer");
        assert.equal(updated.messages.at(-1).content, decision.message);
        assert.equal(
          readInterviewSession(updated.id).interview.messages.at(-1).content,
          decision.message,
        );
        if (streaming) assert.deepEqual(displayed, [decision.message]);
        await new Promise((resolve) => setImmediate(resolve));
        const wire = JSON.parse(
          logs.find(({ msg }) => msg === "HTTP_RESPONSE_BODY").body,
        );
        assert.equal(
          JSON.parse(wire.message.content).message,
          updated.messages.at(-1).content,
        );
        assert.deepEqual(
          logs.find(({ msg }) => msg === "LLM_PARSED_RESPONSE").parsed,
          decision,
        );
        assert.equal(
          logs
            .find(({ msg }) => msg === "INTERVIEW_STATE_AFTER")
            .interview.messages.at(-1).content,
          decision.message,
        );
        assert.ok(logs.some(({ msg }) => msg === "LLM_RAW_RESPONSE"));
      } finally {
        globalThis.fetch = originalFetch;
        globalThis.window = originalWindow;
        installLogger(undefined);
      }
    });
  }
}
