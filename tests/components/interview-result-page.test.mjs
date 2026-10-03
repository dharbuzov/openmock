import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadComponent,
  hookHarness,
  findElement,
} from "../helpers/components.mjs";

test("result page replaces loading with failure and retries into the existing scorecard on the same page", async () => {
  const hooks = hookHarness();
  const requests = [];
  const { InterviewResultPage } = loadComponent(
    "src/components/interview-result-page.tsx",
    {
      react: hooks.react,
      "next/link": { __esModule: true, default: "a" },
      "@/components/ui/button": { Button: "button", buttonVariants: () => "" },
      "@/components/ui/spinner": { Spinner: "spinner" },
      "./interview-results": { ResultsScorecard: "scorecard" },
      "@/lib/interview/evaluation-storage": {
        readResultsRecordValue: () => null,
        parseResultsRecord: () => null,
      },
      "@/lib/interview/evaluation-task": {
        evaluateCompletedSession: (id) =>
          new Promise((resolve, reject) =>
            requests.push({ id, resolve, reject }),
          ),
      },
    },
  );
  const render = () =>
    hooks.render(InterviewResultPage, { interviewId: "session" });
  const initial = render();
  assert.equal(initial.props.role, "status");
  assert.equal(
    findElement(initial, (n) => n.type === "h1").props.children,
    "Evaluating your interview",
  );
  assert.ok(findElement(initial, (n) => n.type === "spinner"));
  assert.equal(requests.length, 1);
  requests[0].reject(new Error("Provider unavailable"));
  await new Promise((resolve) => setImmediate(resolve));
  let tree = render();
  assert.equal(
    findElement(tree, (n) => n.props.role === "alert").props.children,
    "We couldn't generate your evaluation.",
  );
  const retry = findElement(tree, (n) => n.type === "button");
  const first = retry.props.onClick();
  await retry.props.onClick();
  assert.equal(requests.length, 2);
  assert.equal(render().props.role, "status");
  const record = { evaluation: { status: "completed", result: {} } };
  requests[1].resolve(record);
  await first;
  tree = render();
  assert.equal(
    findElement(tree, (n) => n.type === "scorecard").props.record,
    record,
  );
  assert.equal(
    findElement(tree, (n) => n.type === "scorecard").props.interviewId,
    "session",
  );
  assert.equal(requests.length, 2);
});
