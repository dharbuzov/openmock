// Opt-in real calibration and closure checks. Inference is never mocked.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { load } from "../register-typescript.mjs";
import { loadDefinition } from "../content-fixtures.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")),
);
const {
  startInterview,
  acceptCandidateMessage,
  completeInterview,
  buildInterviewContext,
} = load("../src/lib/interview/engine.ts");
const { processCandidateMessage } = load("../src/lib/interview/runner.ts");
const { evaluateInterview, IncompleteEvaluationError } = load(
  "../src/lib/ai/evaluation.ts",
);
const { parseProblemDocument } = load("../src/lib/problems/schema.ts");
const definition = loadDefinition("dsa");
const problem = parseProblemDocument(
  readFileSync("content/problems/dsa/two-sum.md", "utf8"),
);
const settings = {
  provider: "ollama",
  baseUrl: args.endpoint ?? "http://localhost:11434",
  model: args.model ?? "qwen3:8b",
};
const code =
  "class Solution { public int[] twoSum(int[] nums, int target) { java.util.Map<Integer,Integer> seen = new java.util.HashMap<>(); for (int i=0;i<nums.length;i++) { Integer j = seen.get(target-nums[i]); if (j != null) return new int[]{j,i}; seen.put(nums[i],i); } throw new IllegalArgumentException(); } }";
const workspace = {
  type: "code",
  language: "java",
  filename: "Solution.java",
  code,
};
const output = resolve("logs", `ollama-calibration-${Date.now()}`);
mkdirSync(output, { recursive: true });
const originalFetch = globalThis.fetch;
const requests = [];
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith("/api/prompts/"))
    return new Response(
      readFileSync(
        `content/prompts/${String(url).split("/").at(-1)}.md`,
        "utf8",
      ),
    );
  if (typeof init?.body === "string") {
    const body = JSON.parse(init.body);
    assert.equal(body.think, false);
    assert.equal(body.format.type, "object");
    requests.push({
      think: body.think,
      schema: body.format,
      model: body.model,
    });
  }
  return originalFetch(url, init);
};
const results = [];
const cases = [
  {
    name: "basic-principal",
    turns: [
      [
        "approach",
        "What is your approach?",
        "A hash map finds the complement in expected O(n) time and O(n) space.",
      ],
      [
        "implementation",
        "Please implement it.",
        "The single-pass solution is in the workspace. Check before insertion to avoid using the same index.",
      ],
    ],
    expected: (result) => assert.notEqual(result.recommendation, "strong-hire"),
  },
  {
    name: "level-evidence",
    turns: [
      [
        "approach",
        "Justify your approach and limits.",
        "Before index i the map contains only earlier indices. A found complement therefore proves two distinct indices sum to target; every possible pair is checked at its later endpoint. Reading the array imposes a linear lower bound. Expected constant-time lookup depends on hashing; it is not a worst-case guarantee.",
      ],
      [
        "implementation",
        "Implement and validate under the constraints.",
        "The code uses lookup before insertion. I traced [3,3], [2,7,11,15], and [-3,4,3], giving [0,1], [0,1], and [0,2]. Bounds of plus or minus 10^9 mean the complement stays within signed 32-bit range. If bounds widened I would promote operands before subtraction, not cast the overflowed result. I have not run the code.",
      ],
      [
        "analysis",
        "How would you adapt to changed resource and latency constraints?",
        "If deterministic worst-case latency matters, a balanced map gives O(n log n) time; sorting indexed pairs also costs O(n log n) time plus index storage. For sorted inputs two pointers use O(1) extra space. With severe memory constraints on unsorted input, pair enumeration accepts quadratic time; bounded integer ranges may permit direct addressing but only if the range fits memory. For a stream, exact arbitrary complements need retained state that grows with distinct values, so an unbounded stream requires a bounded window or relaxing the guarantee. I would clarify latency, memory, and exactness before choosing.",
      ],
      [
        "wrap-up",
        "What are the limits and validation priorities?",
        "I would property-test against pair enumeration with bounded random arrays, assert returned indices are distinct and sum correctly, and test duplicates and numeric boundaries. The one-solution contract justifies the final throw; it would need a documented empty result or error policy if the contract changed. My choice is the single-pass map for these constraints; I would benchmark actual workloads before asserting predictable tail latency.",
      ],
    ],
    expected: (result) =>
      assert.ok(
        ["hire", "strong-hire"].includes(result.recommendation),
        result.finalAssessment,
      ),
  },
  { name: "interrupted", turns: [], empty: true, incomplete: true },
  {
    name: "demonstrated-weakness",
    turns: [
      [
        "approach",
        "How do you satisfy the distinct-index constraint?",
        "I will use the same index twice. I do not need to satisfy that constraint.",
      ],
    ],
    empty: true,
    expected: (result) =>
      assert.ok(
        result.competencies.some(({ rating }) =>
          ["negative", "strong-negative", "not-demonstrated"].includes(rating),
        ),
      ),
  },
];
try {
  for (const scenario of cases.filter(
    ({ name }) => !args.case || args.case === name,
  )) {
    let interview = startInterview(problem, {
      definition,
      targetLevel: "principal",
      mode: "mock",
    });
    for (const [stage, question, answer] of scenario.turns) {
      interview.messages.push({
        id: crypto.randomUUID(),
        stage,
        role: "interviewer",
        content: question,
        createdAt: interview.startedAt,
      });
      interview.messages.push({
        id: crypto.randomUUID(),
        stage,
        role: "candidate",
        content: answer,
        createdAt: interview.startedAt,
      });
    }
    interview = completeInterview(interview);
    const context = buildInterviewContext(
      interview,
      problem,
      definition,
      scenario.empty ? { ...workspace, code: "" } : workspace,
    );
    try {
      const result = await evaluateInterview(
        settings,
        context,
        AbortSignal.timeout(240_000),
      );
      writeFileSync(
        `${output}/${scenario.name}.json`,
        JSON.stringify({ context, result }, null, 2),
      );
      assert.ok(
        !scenario.incomplete,
        "No opportunity must yield incomplete assessment",
      );
      scenario.expected(result);
      results.push({ name: scenario.name, result });
      console.log(
        JSON.stringify({
          name: scenario.name,
          recommendation: result.recommendation,
          finalAssessment: result.finalAssessment,
        }),
      );
    } catch (error) {
      if (!scenario.incomplete || !(error instanceof IncompleteEvaluationError))
        throw error;
      results.push({
        name: scenario.name,
        status: "incomplete",
        reason: error.message,
      });
      console.log(JSON.stringify(results.at(-1)));
    }
    writeFileSync(
      `${output}/results.json`,
      JSON.stringify({ results, requests }, null, 2),
    );
  }
  let closing = startInterview(problem, { definition });
  closing = {
    ...closing,
    elapsedMs: 46 * 60_000,
    stage: {
      ...closing.stage,
      current: "wrap-up",
      completed: definition.stages.slice(0, -1).map(({ id }) => id),
      startedElapsedMs: 44 * 60_000,
      allowanceMs: 60_000,
    },
  };
  closing.messages.push({
    id: crypto.randomUUID(),
    stage: "wrap-up",
    role: "interviewer",
    content: "Any final testing ideas?",
    createdAt: closing.startedAt,
  });
  closing = acceptCandidateMessage(
    closing,
    "Could the complement overflow an int?",
  );
  const closed = await processCandidateMessage(
    settings,
    closing,
    problem,
    definition,
    workspace,
    AbortSignal.timeout(240_000),
  );
  assert.equal(closed.stage.current, null);
  writeFileSync(`${output}/closure.json`, JSON.stringify(closed, null, 2));
  assert.ok(
    !closed.messages.at(-1).content.includes("?"),
    "Closure must not ask another question",
  );
  assert.match(
    closed.messages.at(-1).content,
    /finish|feedback|conclud|complet/i,
    "Closure must end the discussion",
  );
  console.log(
    JSON.stringify({
      name: "closure",
      message: closed.messages.at(-1).content,
    }),
  );
  writeFileSync(`${output}/closure.json`, JSON.stringify(closed, null, 2));
  console.log(
    JSON.stringify({
      output,
      cases: results.length,
      requests: requests.length,
    }),
  );
} finally {
  globalThis.fetch = originalFetch;
}
