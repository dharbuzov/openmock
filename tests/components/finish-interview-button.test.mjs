import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Finish caller persists the evaluation returned by the runner", () => {
  const source = readFileSync(
    new URL(
      "../../src/components/finish-interview-button.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const finishCall = source.indexOf("await run(");
  const saveCall = source.indexOf(
    "saveResultsRecord(finished, problem, definition)",
  );
  assert.ok(finishCall >= 0);
  assert.ok(saveCall > finishCall);
});
