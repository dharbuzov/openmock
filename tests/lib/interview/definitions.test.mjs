import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../register-typescript.mjs";
import { readFileSync } from "node:fs";
import { loadComponent } from "../../helpers/components.mjs";

const { getInterviewDefinitions, requireInterviewDefinition } = load(
  "../src/lib/interview/definitions.ts",
);
const { startInterview } = load("../src/lib/interview/engine.ts");

test("definition loading is shared across lookups and visibility options, retries failures, and refreshes in development", async () => {
  const previous = process.env.NODE_ENV;
  const template = readFileSync("content/interviews/behavioral.md", "utf8");
  let source = template;
  let reads = 0;
  const freshLoader = () =>
    loadComponent("src/lib/interview/definitions.ts", {
      "node:fs/promises": {
        readdir: async () => [{ name: "behavioral.md", isFile: () => true }],
        readFile: async () => {
          reads++;
          return source;
        },
      },
      "../config/config": {
        config: { interviews: { disabled: ["behavioral"] } },
      },
    });
  try {
    process.env.NODE_ENV = "production";
    const loader = freshLoader();
    const [visible, all, hidden] = await Promise.all([
      loader.getInterviewDefinitions(),
      loader.getInterviewDefinitions({ includeDisabled: true }),
      loader.getInterviewDefinition("behavioral"),
    ]);
    assert.deepEqual(visible, []);
    assert.equal(all[0].id, "behavioral");
    assert.equal(hidden, undefined);
    assert.equal(reads, 1);
    all.pop();
    assert.equal(
      (await loader.getInterviewDefinitions({ includeDisabled: true })).length,
      1,
    );
    assert.equal(reads, 1);

    source = "invalid";
    const retryLoader = freshLoader();
    await assert.rejects(
      retryLoader.getInterviewDefinitions(),
      /Invalid interview definition/,
    );
    source = template;
    await retryLoader.getInterviewDefinitions();
    await retryLoader.getInterviewDefinitions();
    assert.equal(reads, 3);

    process.env.NODE_ENV = "development";
    const devLoader = freshLoader();
    await devLoader.getInterviewDefinitions();
    source = template.replace("name: Behavioral", "name: Updated");
    assert.equal(
      (await devLoader.getInterviewDefinitions({ includeDisabled: true }))[0]
        .name,
      "Updated",
    );
    source = "invalid";
    await assert.rejects(
      devLoader.getInterviewDefinitions(),
      /Invalid interview definition/,
    );
    assert.equal(reads, 6);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

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
