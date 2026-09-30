import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../register-typescript.mjs";

const { parseInterviewDefinitionDocument } = load("../src/lib/interview/definition-schema.ts");

function document(overrides = {}, instructions = "# Interview\n\nAsk one question.") {
  const metadata = {
    id: "example", name: "Example", version: 1, workspace: "none",
    duration: { defaultMinutes: 30 }, stages: ["introduction", "wrap-up"],
    levels: ["junior", "senior"], modes: ["practice", "mock"],
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
  assert.notEqual(first.revision, parseInterviewDefinitionDocument(document({}, "# Interview\n\nAsk two questions.")).revision);
});

test("rejects invalid workspace and empty instructions", () => {
  assert.throws(() => parseInterviewDefinitionDocument(document({ workspace: "chat" })), /workspace/);
  assert.throws(() => parseInterviewDefinitionDocument(document({}, "   ")), /instructions/);
});

test("rejects duplicate stages and competencies", () => {
  assert.throws(() => parseInterviewDefinitionDocument(document({ stages: ["intro", "intro"] })), /stage IDs must be unique/);
  assert.throws(() => parseInterviewDefinitionDocument(document({
    evaluation: {
      recommendations: ["hire"],
      competencies: [{ id: "communication", name: "Communication" }, { id: "communication", name: "Communication again" }],
    },
  })), /competency IDs must be unique/);
});

test("rejects invalid recommendations", () => {
  assert.throws(() => parseInterviewDefinitionDocument(document({
    evaluation: { recommendations: ["maybe"], competencies: [{ id: "communication", name: "Communication" }] },
  })), /evaluation.recommendations/);
});
