import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../register-typescript.mjs";
import { loadDefinition } from "../../content-fixtures.mjs";
import { loadComponent } from "../../helpers/components.mjs";

const { getProblems } = load("../src/lib/problems/loader.ts");
const { startInterview, buildInterviewContext } = load(
  "../src/lib/interview/engine.ts",
);
const { problemDescription } = loadComponent(
  "src/components/problem-panel.tsx",
);

const curated = [
  ["two-sum", "easy", "hash-maps"],
  ["contains-duplicate", "easy", "hash-maps"],
  ["valid-palindrome", "easy", "two-pointers"],
  ["three-sum", "medium", "two-pointers"],
  [
    "longest-substring-without-repeating-characters",
    "medium",
    "sliding-window",
  ],
  ["valid-parentheses", "easy", "stacks"],
  ["search-in-rotated-sorted-array", "medium", "binary-search"],
  ["reverse-linked-list", "easy", "linked-lists"],
  ["linked-list-cycle", "easy", "linked-lists"],
  ["maximum-depth-of-binary-tree", "easy", "trees"],
  ["validate-binary-search-tree", "medium", "trees"],
  ["top-k-frequent-elements", "medium", "heaps"],
  ["number-of-islands", "medium", "graphs"],
  ["climbing-stairs", "easy", "dynamic-programming"],
  ["coin-change", "medium", "dynamic-programming"],
];

test("the 15 curated DSA problems are validated, distinct and complete while LRU Cache remains available", async () => {
  const problems = await getProblems();
  const dsa = problems.filter(({ interview }) => interview === "dsa");
  assert.equal(curated.length, 15);
  assert.equal(dsa.length, 16);
  assert.equal(new Set(problems.map(({ id }) => id)).size, problems.length);
  assert.ok(dsa.some(({ id }) => id === "lru-cache"));
  assert.deepEqual(
    problems
      .filter(({ topics }) => topics.includes("blind-75"))
      .map(({ id }) => id)
      .sort(),
    curated.map(([id]) => id).sort(),
  );
  for (const [id, difficulty, topic] of curated) {
    const problem = dsa.find((problem) => problem.id === id);
    assert.ok(problem, id);
    assert.equal(problem.difficulty, difficulty, id);
    assert.ok(problem.categories.includes("algorithms"), id);
    assert.ok(problem.topics.includes(topic), id);
    assert.equal(problem.language, "java", id);
    assert.match(problem.starterCode, /class Solution/);
    const candidate = problemDescription(problem.content);
    for (const section of [
      "### Example",
      "Input:",
      "Output:",
      "### Constraints",
      "### Edge Cases",
    ])
      assert.ok(
        candidate.includes(section),
        `${id}: candidate can see ${section}`,
      );
    for (const level of ["Junior:", "Middle:", "Senior:", "Staff / Principal:"])
      assert.ok(
        problem.interviewerContext.includes(level),
        `${id}: ${level} assessment guidance`,
      );
    assert.ok(!candidate.includes("Interviewer Context"), id);
    assert.ok(!candidate.includes("Staff / Principal:"), id);
    assert.ok(!candidate.includes("## Discussion"), id);
    assert.equal(problem.level, undefined);
  }
});

test("every curated problem launches and builds interview context for every supported level and mode", async () => {
  const definition = loadDefinition("dsa");
  const problems = await getProblems();
  for (const [id] of curated) {
    const problem = problems.find((problem) => problem.id === id);
    for (const { id: targetLevel } of definition.levels) {
      for (const mode of definition.modes) {
        const interview = startInterview(problem, {
          definition,
          targetLevel,
          mode,
        });
        assert.equal(interview.problemId, id);
        assert.equal(interview.targetLevel, targetLevel);
        assert.equal(interview.mode, mode);
        assert.equal(interview.stage.current, definition.stages[0].id);
        assert.equal(
          interview.durationMinutes,
          definition.duration.defaultMinutes,
        );
        const context = buildInterviewContext(interview, problem, definition, {
          type: "code",
          language: problem.language,
          filename: "solution.java",
          code: problem.starterCode,
        });
        assert.equal(context.workspace.code, problem.starterCode);
        assert.equal(
          context.problem.interviewerContext,
          problem.interviewerContext,
        );
      }
    }
  }
});
