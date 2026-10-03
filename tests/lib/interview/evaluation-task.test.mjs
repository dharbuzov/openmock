import { test } from "node:test";
import assert from "node:assert/strict";
import { loadComponent } from "../../helpers/components.mjs";

function harness() {
  const session = {
    interview: {
      id: "session",
      status: "completed",
      messages: [{ content: "Original answer" }],
    },
    evaluationWorkspace: { type: "code", code: "Original solution" },
    evaluationContext: { problem: { id: "p" }, definition: { id: "dsa" } },
  };
  let saved = null,
    resolve;
  const calls = [];
  const { evaluateCompletedSession } = loadComponent(
    "src/lib/interview/evaluation-task.ts",
    {
      "../settings/storage": { readSettings: () => ({ model: "configured" }) },
      "./session-storage": { readInterviewSession: () => session },
      "./runner": {
        retryEvaluation: (...args) => {
          calls.push(args);
          return new Promise((done) => {
            resolve = done;
          });
        },
      },
      "./evaluation-storage": {
        readResultsRecordValue: () => saved,
        parseResultsRecord: (value) => value,
        saveResultsRecord: (finished) => {
          saved = { evaluation: finished.evaluation };
        },
      },
    },
  );
  return {
    session,
    calls,
    evaluate: () => evaluateCompletedSession("session"),
    finish: (evaluation) =>
      resolve({ interview: session.interview, evaluation }),
  };
}

test("evaluation shares one in-flight request, survives failure, retries original data and reuses successful results", async () => {
  const h = harness();
  const first = h.evaluate();
  assert.equal(h.evaluate(), first);
  await Promise.resolve();
  assert.equal(h.calls.length, 1);
  h.finish({ status: "failed", error: { message: "Provider unavailable" } });
  assert.equal((await first).evaluation.status, "failed");
  assert.equal(h.session.interview.status, "completed");
  const retry = h.evaluate();
  assert.equal(h.evaluate(), retry);
  await Promise.resolve();
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1][1], h.session.interview);
  assert.equal(h.calls[1][4], h.session.evaluationWorkspace);
  h.finish({ status: "completed", result: {} });
  assert.equal((await retry).evaluation.status, "completed");
  await h.evaluate();
  assert.equal(h.calls.length, 2);
});

test("in-progress sessions cannot be evaluated", async () => {
  const h = harness();
  h.session.interview.status = "in-progress";
  await assert.rejects(h.evaluate(), /Completed interview data is unavailable/);
  assert.equal(h.calls.length, 0);
});
