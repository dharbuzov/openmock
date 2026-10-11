// Opt-in REAL integration run. Never imported by tests/all.test.mjs.
// node tests/integration/ollama-interviewer.mjs --think=false --turns=10 --label=baseline
import assert from "node:assert/strict";
import {
  readFileSync,
  mkdirSync,
  appendFileSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import pino from "pino";
import { wrapLanguageModel, defaultSettingsMiddleware } from "ai";
import { load } from "../register-typescript.mjs";
import { loadDefinition } from "../content-fixtures.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")),
);
const think = args.think === "true";
assert.ok(
  ["true", "false"].includes(args.think),
  "Specify --think=true or --think=false",
);
const count = Number(args.turns ?? 10);
const { defaultOllamaSettings } = load("../src/lib/settings/types.ts");
const baseUrl = args.endpoint ?? defaultOllamaSettings.baseUrl;
const model = "qwen3:8b";
const output = resolve(
  "logs",
  `ollama-${args.label ?? "live"}-think-${think}-${Date.now()}`,
);
mkdirSync(output, { recursive: true });
const originalFetch = globalThis.fetch;
const { readPromptResource } = load("../src/lib/ai/prompt-resources.ts");
const { installLogger, wrapLogger } = load("../src/lib/logging/logger.ts");
const records = [];
installLogger(
  wrapLogger(
    pino(
      { level: "trace" },
      {
        write(line) {
          records.push(JSON.parse(line));
          appendFileSync(`${output}/trace.jsonl`, line);
        },
      },
    ),
  ),
);
const version = await originalFetch(`${baseUrl}/api/version`, {
  signal: AbortSignal.timeout(10000),
}).then((r) => r.json());
const tags = await originalFetch(`${baseUrl}/api/tags`, {
  signal: AbortSignal.timeout(10000),
}).then((r) => r.json());
assert.ok(
  tags.models?.some(({ name }) => name === model),
  `${model} unavailable at ${baseUrl}; no replacement is allowed`,
);
const show = await originalFetch(`${baseUrl}/api/show`, {
  method: "POST",
  body: JSON.stringify({ model }),
  headers: { "content-type": "application/json" },
}).then((r) => r.json());
const runtime = await originalFetch(`${baseUrl}/api/ps`).then((r) => r.json());
writeFileSync(
  `${output}/environment.json`,
  JSON.stringify(
    {
      baseUrl,
      version,
      model: tags.models.find(({ name }) => name === model),
      show,
      runtime,
    },
    null,
    2,
  ),
);

// Serve the real prompt resource, as the app does. All inference HTTP is forwarded
// unchanged to the installed Ollama provider and real local service.
const server = createServer(async (req, res) => {
  const name = req.url?.split("/").at(-1);
  if (!["interviewer", "evaluator"].includes(name)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.end(await readPromptResource(name));
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
globalThis.fetch = (input, init) =>
  originalFetch(
    typeof input === "string" && input.startsWith("/api/prompts/")
      ? `http://127.0.0.1:${server.address().port}${input}`
      : input,
    init,
  );
const models = load("../src/lib/ai/model.ts");
const originalFactory = models.getLanguageModel;
models.getLanguageModel = (settings, context) =>
  wrapLanguageModel({
    model: originalFactory(settings, context),
    middleware: defaultSettingsMiddleware({
      settings: { providerOptions: { ollama: { think } } },
    }),
  });
const { startInterview, acceptCandidateMessage } = load(
  "../src/lib/interview/engine.ts",
);
const { processCandidateMessage } = load("../src/lib/interview/runner.ts");
const { parseProblemDocument } = load("../src/lib/problems/schema.ts");
const problem = parseProblemDocument(
  readFileSync("content/problems/dsa/two-sum.md", "utf8"),
);
let definition = loadDefinition("dsa");
const settings = { ...defaultOllamaSettings, baseUrl, model };
const candidates = [
  "Sure. I'd start with a straightforward brute-force approach.\n\nWe could iterate through the array using two nested loops, checking each pair of distinct elements to see whether their sum equals the target.\n\nThis would give us O(n²) time complexity and O(1) extra space.\n\nHowever, I think we can optimize the lookup using additional memory.\n\nWould you like me to explore that optimization before moving to implementation?",
  "I think we could use a hash map to avoid repeatedly scanning the array.",
  "For each number I would check whether target minus that number is already in a map of earlier values to indices. Should I check before inserting the current element?",
  "Checking before insertion avoids reusing the same element. For [3,3] with target 6, the second 3 finds the earlier index. I am ready to implement this approach.",
  "I will implement a single pass in Java: look up the complement, return the earlier index and current index if present, otherwise insert the current value and index.",
  "The code is in the workspace. For [2,7,11,15] and target 9, I insert 2 at index 0, then at index 1 find complement 2 and return [0,1].",
  "For duplicates [3,3] and target 6 it returns [0,1]. For negative numbers [-3,4,3] and target 0 it finds [-3,3]. The check before insertion prevents using one index twice.",
  "Under the stated constraints there is exactly one solution, so an empty result is unreachable. Could the complement overflow an int under these constraints?",
  "Expected time is O(n) with expected constant-time HashMap operations, and extra space is O(n). Compared with O(n²) brute force, we use additional memory to avoid repeated scans.",
  "Hash collisions can make lookups slower in the worst case. Sorting could allow two pointers but costs O(n log n) and requires retaining original indices. I would retain the hash-map solution here.",
];
const code =
  "class Solution { public int[] twoSum(int[] nums, int target) { java.util.Map<Integer,Integer> seen = new java.util.HashMap<>(); for (int i=0;i<nums.length;i++) { Integer j = seen.get(target-nums[i]); if (j != null) return new int[]{j,i}; seen.put(nums[i],i); } throw new IllegalArgumentException(); } }";
const summary = { output, think, version, turns: [], requests: 0 };
let interview = startInterview(problem, {
  definition,
  targetLevel: "senior",
  mode: "practice",
});
const replay = args.replay
  ? readFileSync(args.replay, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
      .find(
        (entry) =>
          entry.msg === "INTERVIEW_STATE_BEFORE" &&
          entry.interview.messages.at(-1)?.content === candidates[4],
      )
  : undefined;
if (args.replay)
  assert.ok(replay, "Failing conversation missing from replay trace");
if (replay) {
  interview = replay.interview;
  definition = replay.definition;
  // Preserve the captured definition and elapsed time; replaying later must not
  // trigger an unrelated wall-clock stage transition.
  interview = {
    ...interview,
    timer: {
      elapsedMs:
        (interview.timer?.elapsedMs ?? 0) +
        (interview.timer?.runningSince
          ? Math.max(0, replay.time - interview.timer.runningSince)
          : 0),
      runningSince: null,
    },
  };
}
console.log(
  JSON.stringify({
    event: "START",
    output,
    think,
    version,
    thinkingSupport: show.thinking,
  }),
);
try {
  for (
    let i = replay ? 4 : -1;
    i < (replay ? 5 : Math.min(count, candidates.length));
    i++
  ) {
    if (interview.stage.current === null) {
      console.log("Interview flow closed by engine");
      break;
    }
    const input = i < 0 ? null : candidates[i];
    if (input && !replay) interview = acceptCandidateMessage(interview, input);
    const before = records.length;
    const started = Date.now();
    const stageBefore = interview.stage.current;
    let result;
    try {
      const displayed = [];
      interview = await processCandidateMessage(
        settings,
        interview,
        problem,
        definition,
        {
          type: "code",
          language: "java",
          filename: "Solution.java",
          code: i >= 5 ? code : problem.starterCode,
        },
        AbortSignal.timeout(240000),
        args.stream === "false" ? undefined : (text) => displayed.push(text),
        i < 0,
      );
      const reply = interview.messages.at(-1);
      assert.equal(reply.role, "interviewer");
      const normalize = (text) =>
        text.toLowerCase().replace(/\s+/g, " ").trim();
      const sentences =
        input?.split(/(?<=[.!?])\s+/).filter((s) => s.length >= 40) ?? [];
      const fullEcho =
        input !== null && normalize(input) === normalize(reply.content);
      const partialEcho = sentences.some((s) =>
        normalize(reply.content).includes(normalize(s)),
      );
      const historyEcho = interview.messages
        .filter(({ role }) => role === "candidate")
        .some(
          ({ content }) =>
            normalize(content) === normalize(reply.content) ||
            content
              .split(/(?<=[.!?])\s+/)
              .some(
                (sentence) =>
                  sentence.length >= 40 &&
                  normalize(sentence) === normalize(reply.content),
              ),
        );
      result = {
        index: i,
        input,
        stageBefore,
        stageAfter: interview.stage.current,
        response: reply.content,
        fullEcho,
        partialEcho,
        historyEcho,
        success: !fullEcho && !partialEcho && !historyEcho,
        durationMs: Date.now() - started,
      };
      if (displayed.length) assert.equal(displayed.at(-1), reply.content);
    } catch (error) {
      result = {
        index: i,
        input,
        stageBefore,
        success: false,
        error: error.message,
        durationMs: Date.now() - started,
      };
    }
    const turnLogs = records.slice(before);
    result.requests = turnLogs.filter(
      ({ msg }) => msg === "HTTP_REQUEST_BODY",
    ).length;
    result.roles = turnLogs
      .filter(({ msg }) => msg === "HTTP_REQUEST_BODY")
      .map(({ body }) => {
        const request = JSON.parse(body);
        assert.equal(request.think, think);
        return request.messages.map(({ role }) => role);
      });
    summary.requests += result.requests;
    summary.turns.push(result);
    writeFileSync(`${output}/summary.json`, JSON.stringify(summary, null, 2));
    writeFileSync(
      `${output}/interview.json`,
      JSON.stringify(interview, null, 2),
    );
    console.log(JSON.stringify(result));
  }
} finally {
  models.getLanguageModel = originalFactory;
  globalThis.fetch = originalFetch;
  installLogger(undefined);
  server.close();
}
console.log(
  JSON.stringify({
    event: "COMPLETE",
    output,
    successful: summary.turns.filter((t) => t.success).length,
    failed: summary.turns.filter((t) => !t.success).length,
    requests: summary.requests,
  }),
);
if (summary.turns.some((t) => !t.success)) process.exitCode = 1;
