import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../register-typescript.mjs";

const { getInterviewDefinitions, requireInterviewDefinition } = load(
  "../src/lib/interview/definitions.ts",
);
const { startInterview } = load("../src/lib/interview/engine.ts");

test("discovers every content/interviews/*.md file without a registry", async () => {
  const definitions = await getInterviewDefinitions();
  assert.deepEqual(definitions.map(({ id }) => id).sort(), [
    "behavioral",
    "dsa",
    "system-design",
  ]);
  assert.ok(
    definitions.every(
      ({ instructions, revision }) =>
        instructions.length > 0 && revision.length === 64,
    ),
  );
});

test("behavioral content resolves with no workspace and starts in the generic engine", async () => {
  const definition = await requireInterviewDefinition("behavioral");
  const problem = {
    id: "conflict-with-teammate",
    title: "Conflict",
    interview: "behavioral",
    difficulty: "medium",
    categories: [],
    topics: [],
    companies: [],

    content: "Tell me about a conflict.",
  };
  const interview = startInterview(problem, {
    definition,
    targetLevel: "staff",
    mode: "mock",
  });
  assert.equal(definition.workspace, "none");
  assert.equal(interview.definition.id, "behavioral");
  assert.equal(interview.stage.current, "introduction");
});
