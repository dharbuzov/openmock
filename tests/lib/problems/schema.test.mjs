import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../register-typescript.mjs";

const { parseProblemDocument, parseProblemMetadata } = load(
  "../src/lib/problems/schema.ts",
);

test("optional problem metadata arrays default safely", () => {
  const metadata = parseProblemMetadata({
    id: "queue",
    title: "Queue",
    interview: "system-design",
    difficulty: "medium",
  });
  assert.deepEqual(metadata.categories, []);
  assert.deepEqual(metadata.topics, []);
  assert.deepEqual(metadata.companies, []);
});

test("company metadata preserves relation and optional provenance", () => {
  const metadata = parseProblemMetadata({
    id: "queue",
    title: "Queue",
    interview: "system-design",
    difficulty: "hard",
    companies: [
      { id: "example-co", relation: "reported", source: "candidate report" },
    ],
  });
  assert.deepEqual(metadata.companies, [
    { id: "example-co", relation: "reported", source: "candidate report" },
  ]);
});

test("interviewer context remains metadata and never becomes candidate content", () => {
  const problem = parseProblemDocument(
    `---\nid: queue\ntitle: Queue\ninterview: system-design\ndifficulty: easy\n---\n# Candidate prompt\n\nDesign a queue.\n\n# Interviewer Context\n\nAsk about backpressure.`,
  );
  assert.equal(problem.interviewerContext, "Ask about backpressure.");
  assert.equal(problem.content, "# Candidate prompt\n\nDesign a queue.");
  assert.ok(!problem.content.includes("backpressure"));
});

test("problem works without Interviewer Context and preserves its explicit interview reference", () => {
  const problem = parseProblemDocument(
    `---\nid: collaboration\ntitle: Collaboration\ninterview: behavioral\ndifficulty: medium\n---\nTell me about collaboration.`,
  );
  assert.equal(problem.interview, "behavioral");
  assert.equal(problem.content, "Tell me about collaboration.");
  assert.equal(problem.interviewerContext, undefined);
});

test("removed problem fields are rejected, never used as fallbacks", () => {
  const metadata = {
    id: "queue",
    title: "Queue",
    interview: "system-design",
    difficulty: "easy",
  };
  for (const field of ["type", "level", "tags"]) {
    assert.throws(
      () =>
        parseProblemMetadata({
          ...metadata,
          [field]: field === "tags" ? [] : "system-design",
        }),
      new RegExp(field),
    );
  }
  const { interview, ...missingReference } = metadata;
  assert.throws(() => parseProblemMetadata(missingReference), /interview/);
});

test("taxonomy requires slug IDs and rejects malformed arrays", () => {
  const metadata = {
    id: "queue",
    title: "Queue",
    interview: "system-design",
    difficulty: "medium",
  };
  for (const field of ["categories", "topics", "companies"]) {
    assert.throws(
      () => parseProblemMetadata({ ...metadata, [field]: null }),
      new RegExp(field),
    );
  }
  assert.throws(
    () => parseProblemMetadata({ ...metadata, topics: ["High Scale"] }),
    /topics/,
  );
});

test("difficulty is required and accepts only easy, medium, or hard", () => {
  const input = { id: "queue", title: "Queue", interview: "system-design" };
  assert.throws(() => parseProblemMetadata(input), /difficulty/);
  for (const difficulty of ["low", "high", "extreme", null]) {
    assert.throws(
      () => parseProblemMetadata({ ...input, difficulty }),
      /difficulty/,
    );
  }
  for (const difficulty of ["easy", "medium", "hard"]) {
    assert.equal(
      parseProblemMetadata({ ...input, difficulty }).difficulty,
      difficulty,
    );
  }
});
