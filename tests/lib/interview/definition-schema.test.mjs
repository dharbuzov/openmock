import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../register-typescript.mjs";

const { parseInterviewDefinitionDocument } = load(
  "../src/lib/interview/definition-schema.ts",
);

function document(
  overrides = {},
  instructions = "# Interview\n\nAsk one question.",
) {
  const metadata = {
    id: "example",
    name: "Example",
    version: 1,
    workspace: "none",
    duration: { defaultMinutes: 30 },
    stages: ["introduction", "wrap-up"],
    defaultLevel: "senior",
    levels: ["junior", "senior"],
    defaultMode: "practice",
    modes: ["practice", "mock"],
    evaluation: {
      recommendations: ["hire", "mixed", "no-hire"],
      competencies: [{ id: "communication", name: "Communication" }],
    },
    ...overrides,
  };
  return `---\n${JSON.stringify(metadata)}\n---\n\n${instructions}\n`;
}

test("parses frontmatter, preserves instructions, and generates a deterministic revision", () => {
  const source = document();
  const first = parseInterviewDefinitionDocument(source);
  const second = parseInterviewDefinitionDocument(source);
  assert.equal(first.workspace, "none");
  assert.deepEqual(first.stages, [{ id: "introduction" }, { id: "wrap-up" }]);
  assert.match(first.instructions, /Ask one question/);
  assert.equal(first.revision, second.revision);
  assert.notEqual(
    first.revision,
    parseInterviewDefinitionDocument(
      document({}, "# Interview\n\nAsk two questions."),
    ).revision,
  );
});

test("rejects invalid workspace and empty instructions", () => {
  assert.throws(
    () => parseInterviewDefinitionDocument(document({ workspace: "chat" })),
    /workspace/,
  );
  assert.throws(
    () => parseInterviewDefinitionDocument(document({}, "   ")),
    /instructions/,
  );
});

test("rejects duplicate stages and competencies", () => {
  assert.throws(
    () =>
      parseInterviewDefinitionDocument(
        document({ stages: ["intro", "intro"] }),
      ),
    /stage IDs must be unique/,
  );
  assert.throws(
    () =>
      parseInterviewDefinitionDocument(
        document({
          evaluation: {
            recommendations: ["hire"],
            competencies: [
              { id: "communication", name: "Communication" },
              { id: "communication", name: "Communication again" },
            ],
          },
        }),
      ),
    /competency IDs must be unique/,
  );
});

test("rejects invalid recommendations", () => {
  assert.throws(
    () =>
      parseInterviewDefinitionDocument(
        document({
          evaluation: {
            recommendations: ["maybe"],
            competencies: [{ id: "communication", name: "Communication" }],
          },
        }),
      ),
    /evaluation.recommendations/,
  );
});

test("presentation metadata is optional, preserved, and validated", () => {
  const legacy = parseInterviewDefinitionDocument(document());
  assert.equal(legacy.icon, undefined);
  assert.equal(legacy.order, undefined);
  assert.equal(legacy.description, undefined);
  const metadata = {
    description: "Query relational data",
    icon: "database",
    order: 40,
  };
  const parsed = parseInterviewDefinitionDocument(document(metadata));
  for (const [key, value] of Object.entries(metadata))
    assert.equal(parsed[key], value);
  // Unknown icon identifiers remain valid content; the UI provides a fallback.
  assert.equal(
    parseInterviewDefinitionDocument(document({ icon: "future-icon" })).icon,
    "future-icon",
  );
  for (const invalid of [
    { order: "40" },
    { order: 1.5 },
    { icon: "" },
    { description: "" },
  ])
    assert.throws(
      () => parseInterviewDefinitionDocument(document(invalid)),
      /order|icon|description/,
    );
});

test("definitions require defaults referencing nonempty declared levels and modes", () => {
  const valid = parseInterviewDefinitionDocument(
    document({ defaultLevel: "junior", defaultMode: "mock" }),
  );
  assert.equal(valid.defaultLevel, "junior");
  assert.equal(valid.defaultMode, "mock");
  for (const invalid of [
    { defaultLevel: undefined },
    { defaultMode: undefined },
    { defaultLevel: "staff" },
    { modes: ["mock"] },
    { levels: [] },
    { modes: [] },
  ])
    assert.throws(
      () => parseInterviewDefinitionDocument(document(invalid)),
      /defaultLevel|defaultMode|levels|modes/,
    );
});
