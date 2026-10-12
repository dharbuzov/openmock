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
const { filterProblems } = loadComponent(
  "src/components/practice-problems.tsx",
);

const curated = [
  ["url-shortener", "medium", "caching"],
  ["distributed-rate-limiter", "medium", "rate-limiting"],
  ["notification-system", "medium", "asynchronous-processing"],
  ["real-time-chat-system", "medium", "real-time-systems"],
  ["news-feed", "hard", "fan-out"],
  ["cloud-file-storage-system", "hard", "synchronization"],
  ["web-crawler", "medium", "deduplication"],
  ["payment-processing-system", "hard", "reconciliation"],
  ["distributed-job-scheduler", "hard", "scheduling"],
  ["event-streaming-platform", "hard", "replication"],
];

test("ten System Design problems validate with unique IDs, content and seniority guidance", async () => {
  const catalog = await getProblems();
  const problems = catalog.filter(
    ({ interview }) => interview === "system-design",
  );
  assert.deepEqual(
    problems.map(({ id }) => id).sort(),
    curated.map(([id]) => id).sort(),
  );
  assert.equal(new Set(catalog.map(({ id }) => id)).size, catalog.length);
  for (const [id, difficulty, topic] of curated) {
    const problem = problems.find((problem) => problem.id === id);
    assert.equal(problem.difficulty, difficulty, id);
    assert.deepEqual(problem.categories, ["distributed-systems", "backend"]);
    assert.ok(problem.topics.includes(topic), id);
    for (const section of [
      "## Functional Requirements",
      "## Non-Functional Requirements",
      "## Scale",
      "## Constraints",
      "## Discussion",
    ])
      assert.ok(problem.content.includes(section), `${id}: ${section}`);
    const candidate = problemDescription(problem.content);
    assert.ok(candidate.includes("### Example"), id);
    assert.ok(!candidate.includes("## Scale"), id);
    assert.ok(!candidate.includes("# Interviewer Context"), id);
    for (const level of ["Middle:", "Senior:", "Staff:", "Principal:"])
      assert.ok(problem.interviewerContext.includes(level), `${id}: ${level}`);
    assert.equal(problem.language, undefined);
    assert.equal(problem.starterCode, undefined);
    assert.equal(problem.level, undefined);
  }
});

test("every System Design problem launches at all requested seniorities in both supported modes", async () => {
  const definition = loadDefinition("system-design");
  const problems = (await getProblems()).filter(
    ({ interview }) => interview === definition.id,
  );
  for (const problem of problems) {
    for (const targetLevel of ["middle", "senior", "staff", "principal"]) {
      for (const mode of definition.modes) {
        const interview = startInterview(problem, {
          definition,
          targetLevel,
          mode,
        });
        const context = buildInterviewContext(interview, problem, definition);
        assert.equal(interview.problemId, problem.id);
        assert.equal(interview.targetLevel, targetLevel);
        assert.equal(interview.mode, mode);
        assert.equal(
          interview.durationMinutes,
          definition.duration.defaultMinutes,
        );
        assert.equal(interview.stage.current, definition.stages[0].id);
        assert.equal(context.workspace.type, "diagram");
        assert.equal(
          context.problem.interviewerContext,
          problem.interviewerContext,
        );
      }
    }
  }
});

test("System Design filtering combines category, difficulty and topics without leaking hidden guidance", async () => {
  const catalog = await getProblems();
  const problems = catalog.filter(
    ({ interview }) => interview === "system-design",
  );
  const all = {
    interview: "system-design",
    company: "",
    search: "",
    difficulty: "",
  };
  for (const category of ["distributed-systems", "backend", "algorithms"]) {
    for (const difficulty of ["", "easy", "medium", "hard"]) {
      for (const topic of new Set(problems.flatMap(({ topics }) => topics))) {
        const expected = problems.filter(
          (problem) =>
            problem.categories.includes(category) &&
            (!difficulty || problem.difficulty === difficulty) &&
            problem.topics.includes(topic),
        );
        assert.deepEqual(
          filterProblems(catalog, { ...all, category, difficulty, topic }).map(
            ({ id }) => id,
          ),
          expected.map(({ id }) => id),
        );
      }
    }
  }
  assert.deepEqual(
    filterProblems(catalog, { ...all, search: "reconciliation" }).map(
      ({ id }) => id,
    ),
    ["payment-processing-system"],
  );
  assert.deepEqual(
    filterProblems(catalog, { ...all, search: "50000 due runs" }),
    [],
  );
});
