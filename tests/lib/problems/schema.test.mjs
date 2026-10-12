import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../register-typescript.mjs";

const { parseProblemDocument, parseProblemMetadata } = load(
  "../src/lib/problems/schema.ts",
);

test("shared required fields and optional field types are validated", () => {
  const valid = {
    id: "example",
    title: "Example",
    interview: "dsa",
    difficulty: "easy",
  };
  for (const field of Object.keys(valid)) {
    const input = { ...valid };
    delete input[field];
    assert.throws(() => parseProblemMetadata(input), new RegExp(field));
  }
  for (const [field, values] of Object.entries({
    id: [42, "Bad ID", ""],
    title: [42, "   "],
    interview: [42, "System Design", ""],
    difficulty: [42, "extreme"],
    duration: [45, "45", []],
    categories: ["arrays", [42]],
    topics: ["arrays", [42]],
    companies: [
      "Google",
      [42],
      [{ id: "Google", relation: "unknown" }],
      [{ id: 42, relation: "reported" }],
      [{ id: "Google", relation: "reported", source: 42 }],
      [{ id: "Google", relation: "reported", typo: true }],
    ],
    language: [42, "   "],
    starterCode: [42, "   "],
    interviewerContext: [42, "   "],
  })) {
    for (const value of values) {
      assert.throws(
        () => parseProblemMetadata({ ...valid, [field]: value }),
        new RegExp(field),
      );
    }
  }
});

test("DSA and System Design documents share metadata without changing starter source", () => {
  const starterCode = "  return 1;\n";
  const dsa = parseProblemDocument(
    `---\nid: example\ntitle: Example\ninterview: dsa\ndifficulty: easy\nlanguage: python\nstarterCode: |2\n    return 1;\n---\n## Description\nSolve it.`,
  );
  assert.equal(dsa.starterCode, starterCode);
  assert.equal(dsa.language, "python");
  const design = parseProblemDocument(
    `\uFEFF---\r\nid: example\r\ntitle: Example\r\ninterview: system-design\r\ndifficulty: hard\r\ncompanies: [Google]\r\n---\r\n## Description\r\nDesign it.`,
  );
  assert.deepEqual(design.companies, [{ id: "Google", relation: "relevant" }]);
  assert.equal(design.language, undefined);
});

test("invalid YAML, missing frontmatter and empty Markdown fail", () => {
  for (const source of [
    "Prompt",
    "---\nid: [\n---\nPrompt",
    "---\n[]\n---\nPrompt",
    "---\nid: example\ntitle: Example\ninterview: dsa\ndifficulty: easy\n---\n# Interviewer Context\nHidden only",
  ])
    assert.throws(() => parseProblemDocument(source));
});

test("problem duration is optional and accepts only positive integer minutes", () => {
  const metadata = {
    id: "queue",
    title: "Queue",
    interview: "system-design",
    difficulty: "medium",
  };
  assert.equal(parseProblemMetadata(metadata).duration, undefined);
  assert.deepEqual(
    parseProblemMetadata({ ...metadata, duration: { minutes: 45 } }).duration,
    { minutes: 45 },
  );
  for (const minutes of [0, -1, 1.5, "45", null]) {
    assert.throws(() =>
      parseProblemMetadata({ ...metadata, duration: { minutes } }),
    );
  }
  assert.throws(() => parseProblemMetadata({ ...metadata, duration: {} }));
});

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
