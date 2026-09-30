import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Finish caller persists the evaluation returned by the engine", () => {
  const source = readFileSync(new URL("./finish-interview-button.tsx", import.meta.url), "utf8");
  const finishCall = source.indexOf("await finishInterview(");
  const saveCall = source.indexOf("saveEvaluation(finished.evaluation)");
  assert.ok(finishCall >= 0);
  assert.ok(saveCall > finishCall);
});
