import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../register-typescript.mjs";

const { getProblems, validateProblemDefinitions } = load(
  "../src/lib/problems/loader.ts",
);
const { getInterviewDefinitions } = load("../src/lib/interview/definitions.ts");

test("all discovered problems reference discovered interview definitions", async () => {
  const [problems, definitions] = await Promise.all([
    getProblems(),
    getInterviewDefinitions(),
  ]);
  const behavioral = problems.find(({ id }) => id === "conflict-with-teammate");
  assert.equal(behavioral.interview, "behavioral");
  assert.equal(
    definitions.find(({ id }) => id === behavioral.interview).workspace,
    "none",
  );
});

test("unknown interview references fail clearly", async () => {
  const definitions = await getInterviewDefinitions();
  assert.throws(
    () =>
      validateProblemDefinitions(
        [
          {
            id: "unknown",
            title: "Unknown",
            interview: "missing",
            complexity: "low",
            categories: [],
            topics: [],
            companies: [],
            tags: [],
            content: "Prompt",
          },
        ],
        definitions,
      ),
    /unknown interview definition: missing/,
  );
});
