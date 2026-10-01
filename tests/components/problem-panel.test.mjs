import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadComponent } from "../helpers/components.mjs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "../register-typescript.mjs";

const { parseProblemDocument, parseProblemMetadata } = load(
  "../src/lib/problems/schema.ts",
);
const { interviewContext } = load("../src/lib/ai/prompts.ts");
const { ProblemPanel, problemDescription } = loadComponent(
  "src/components/problem-panel.tsx",
  {
    "@/components/ui/badge": {
      Badge: ({ variant, ...props }) =>
        React.createElement("span", { ...props, "data-variant": variant }),
    },
  },
);

test("candidate panel renders title, badges, description and example without hidden sections", () => {
  const problem = parseProblemDocument(
    readFileSync("content/problems/system-design/url-shortener.md", "utf8"),
  );
  const html = renderToStaticMarkup(
    React.createElement(ProblemPanel, { problem }),
  );
  for (const text of [
    problem.title,
    "System Design",
    "Medium",
    "Senior",
    "TinyURL",
    "short.ly/abc123",
  ])
    assert.ok(html.includes(text), text);
  for (const text of [
    "Functional Requirements",
    "Non-Functional Requirements",
    "100 million",
    "Discussion",
    "hot URLs",
  ])
    assert.ok(!html.includes(text), text);
  assert.ok(!html.includes(">Bitly<"));
  assert.ok(!html.includes("<dt"));
  assert.ok(html.includes("data-flow-arrow"));
  assert.match(problem.content, /100 million/);
  const context = JSON.parse(
    interviewContext({
      problem,
      definition: {
        id: "system-design",
        duration: { defaultMinutes: 45 },
        evaluation: { competencies: [] },
      },
      interview: { startedAt: new Date().toISOString() },
    }),
  );
  assert.match(context.problem.content, /Functional Requirements/);
  assert.match(context.problem.content, /100 million/);
  assert.match(context.problem.interviewerContext, /hot URLs/);
});

test("description selection respects code fences and subsections and never falls back to full content", () => {
  assert.equal(problemDescription("## Scale\nsecret"), "");
  assert.equal(
    problemDescription(
      "## Description\nGiven\n### Example\n```text\n## Scale\n```\n## Hints\nsecret",
    ),
    "Given\n### Example\n```text\n## Scale\n```",
  );
});

test("frontmatter supports typed difficulty and level and company names", () => {
  const metadata = parseProblemMetadata({
    id: "example",
    title: "Example",
    type: "sql",
    difficulty: "hard",
    level: "staff",
    companies: ["Bitly"],
  });
  assert.equal(metadata.interview, "sql");
  assert.equal(metadata.complexity, "high");
  assert.equal(metadata.level, "staff");
  assert.deepEqual(metadata.companies, [{ id: "Bitly", relation: "relevant" }]);
  assert.throws(
    () => parseProblemMetadata({ ...metadata, difficulty: "extreme" }),
    /difficulty/,
  );
  assert.throws(
    () => parseProblemMetadata({ ...metadata, level: "expert" }),
    /level/,
  );
});

test("all current problems have a nonempty candidate Description", () => {
  for (const file of [
    "system-design/url-shortener",
    "dsa/two-sum",
    "dsa/lru-cache",
    "behavioral/conflict-with-teammate",
  ]) {
    const problem = parseProblemDocument(
      readFileSync(`content/problems/${file}.md`, "utf8"),
    );
    assert.ok(problemDescription(problem.content), file);
  }
});
