import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { load } from "../../register-typescript.mjs";
import { loadDefinition } from "../../content-fixtures.mjs";

const { readPromptResource } = load("../src/lib/ai/prompt-resources.ts");
const { interviewerSystemPrompt } = load("../src/lib/ai/prompts.ts");
const { startInterview, buildInterviewContext, acceptCandidateMessage } = load(
  "../src/lib/interview/engine.ts",
);

function engineState(prompt) {
  return JSON.parse(prompt.split("Engine state (data):\n").at(-1));
}

test("Markdown owns behavior while runtime tasks preserve definitions and engine state across interview types", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(await readPromptResource("interviewer"));
  try {
    const globalPrompt = await readPromptResource("interviewer");
    for (const id of ["dsa", "system-design", "sql", "behavioral"]) {
      const definition =
        id === "sql"
          ? { ...loadDefinition("dsa"), id: "sql", name: "SQL" }
          : loadDefinition(id);
      const problem = { id: "example", interview: id, title: "Example" };
      const before = structuredClone(definition);
      for (const mode of definition.modes) {
        const interview = startInterview(problem, { definition, mode });
        const context = buildInterviewContext(interview, problem, definition);
        const prompt = await interviewerSystemPrompt(context);
        assert.ok(prompt.startsWith(globalPrompt));
        assert.ok(prompt.includes(definition.instructions));
        assert.deepEqual(engineState(prompt), {
          task: "opening",
          currentStageId: definition.stages[0].id,
          transition: null,
        });
        const reply = acceptCandidateMessage(
          interview,
          "Can I clarify the requirements?",
        );
        assert.equal(
          engineState(
            await interviewerSystemPrompt(
              buildInterviewContext(reply, problem, definition),
            ),
          ).task,
          "follow-up",
        );
        const transition = {
          from: definition.stages[0].id,
          to: definition.stages[1].id,
          reason: "ready",
        };
        const destination = await interviewerSystemPrompt({
          ...context,
          transition,
          interview: {
            ...interview,
            stage: { ...interview.stage, current: transition.to },
          },
        });
        assert.deepEqual(engineState(destination), {
          task: "follow-up",
          currentStageId: transition.to,
          transition,
        });
        const closing = await interviewerSystemPrompt({
          ...context,
          transition: { ...transition, to: null },
        });
        assert.equal(engineState(closing).task, "closing");
        assert.equal(interview.stage.current, definition.stages[0].id);
        assert.deepEqual(interview.messages, []);
      }
      assert.deepEqual(definition, before);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("loads required global prompts from content/prompts resources", async () => {
  assert.match(
    await readPromptResource("interviewer"),
    /OpenMock's interviewer/,
  );
  assert.match(await readPromptResource("evaluator"), /supplied evidence/);
});

test("missing and empty required prompts fail clearly", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "openmock-prompts-"));
  try {
    await mkdir(path.join(root, "content", "prompts"), { recursive: true });
    await writeFile(
      path.join(root, "content", "prompts", "evaluator.md"),
      "   ",
      "utf8",
    );
    await assert.rejects(
      readPromptResource("interviewer", root),
      /Required prompt could not be loaded/,
    );
    await assert.rejects(
      readPromptResource("evaluator", root),
      /Required prompt is empty/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("interviewer prompt composes the global resource before interview instructions", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(String(url), "/api/prompts/interviewer");
    return new Response(await readPromptResource("interviewer"));
  };
  try {
    const definition = loadDefinition("behavioral");
    const composed = await interviewerSystemPrompt({
      definition,
      interview: {
        startedAt: new Date().toISOString(),
        stage: { current: "introduction" },
      },
    });
    const globalIndex = composed.indexOf("OpenMock's interviewer");
    const definitionIndex = composed.indexOf("# Behavioral Interview");
    assert.ok(globalIndex >= 0);
    assert.ok(definitionIndex > globalIndex);
    assert.ok(composed.indexOf("Engine state (data):") > definitionIndex);
    assert.deepEqual(engineState(composed), {
      task: "follow-up",
      currentStageId: "introduction",
      transition: null,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production prompt composition no longer exports the hardcoded constant", () => {
  const prompts = load("node:fs").readFileSync("src/lib/ai/prompts.ts", "utf8");
  assert.ok(!prompts.includes("BASE_INTERVIEWER_SYSTEM_PROMPT"));
  for (const instruction of [
    "Ask exactly one",
    "Return a brief closing",
    "Judge readiness",
    "The discussion is OVER",
    "Do not announce",
  ])
    assert.ok(!prompts.includes(instruction), instruction);
});

test("next-turn instructions follow the engine's approved destination without changing the definition", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(await readPromptResource("interviewer"));
  try {
    const definition = loadDefinition("system-design");
    const transition = {
      from: "requirements",
      to: "high-level-design",
      reason: "ready",
    };
    const before = structuredClone(definition);
    const composed = await interviewerSystemPrompt({
      definition,
      interview: { stage: { current: transition.to } },
      transition,
    });
    assert.equal(engineState(composed).currentStageId, "high-level-design");
    assert.ok(composed.includes(JSON.stringify(transition)));
    assert.ok(composed.includes(definition.instructions));
    assert.deepEqual(definition, before);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
