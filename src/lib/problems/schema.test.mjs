import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../../tests/register-typescript.mjs";

const { parseProblemDocument, parseProblemMetadata } = load("../src/lib/problems/schema.ts");

test("optional problem metadata arrays default safely", () => {
  const metadata = parseProblemMetadata({ id: "queue", title: "Queue", interview: "system-design", complexity: "medium" });
  assert.deepEqual(metadata.categories, []);
  assert.deepEqual(metadata.topics, []);
  assert.deepEqual(metadata.companies, []);
  assert.deepEqual(metadata.tags, []);
});

test("company metadata preserves relation and optional provenance", () => {
  const metadata = parseProblemMetadata({
    id: "queue", title: "Queue", interview: "system-design", complexity: "high",
    companies: [{ id: "example-co", relation: "reported", source: "candidate report" }],
  });
  assert.deepEqual(metadata.companies, [{ id: "example-co", relation: "reported", source: "candidate report" }]);
});

test("interviewer context remains metadata and never becomes candidate content", () => {
  const problem = parseProblemDocument(`---\nid: queue\ntitle: Queue\ninterview: system-design\ncomplexity: low\n---\n# Candidate prompt\n\nDesign a queue.\n\n# Interviewer Context\n\nAsk about backpressure.`);
  assert.equal(problem.interviewerContext, "Ask about backpressure.");
  assert.equal(problem.content, "# Candidate prompt\n\nDesign a queue.");
  assert.ok(!problem.content.includes("backpressure"));
});

test("problem works without Interviewer Context and preserves its explicit interview reference", () => {
  const problem = parseProblemDocument(`---\nid: collaboration\ntitle: Collaboration\ninterview: behavioral\ncomplexity: medium\n---\nTell me about collaboration.`);
  assert.equal(problem.interview, "behavioral");
  assert.equal(problem.content, "Tell me about collaboration.");
  assert.equal(problem.interviewerContext, undefined);
});

test("legacy type and level frontmatter remains readable", () => {
  const metadata = parseProblemMetadata({
    id: "legacy-design", title: "Legacy", type: "system-design", level: "senior", tags: ["systems"],
  });
  assert.equal(metadata.interview, "system-design");
  assert.equal(metadata.complexity, "low");
  assert.deepEqual(metadata.tags, ["systems"]);
});
