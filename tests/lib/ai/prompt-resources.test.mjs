import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { load } from "../../register-typescript.mjs";
import { loadDefinition } from "../../content-fixtures.mjs";

const { readPromptResource } = load("../src/lib/ai/prompt-resources.ts");
const { interviewerSystemPrompt } = load("../src/lib/ai/prompts.ts");

test("loads required global prompts from root prompt resources", async () => {
  assert.match(await readPromptResource("interviewer"), /OpenMock's interviewer/);
  assert.match(await readPromptResource("evaluator"), /supplied evidence/);
});

test("missing and empty required prompts fail clearly", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "openmock-prompts-"));
  try {
    await mkdir(path.join(root, "prompts"));
    await writeFile(path.join(root, "prompts", "evaluator.md"), "   ", "utf8");
    await assert.rejects(readPromptResource("interviewer", root), /Required prompt could not be loaded/);
    await assert.rejects(readPromptResource("evaluator", root), /Required prompt is empty/);
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
      interview: { startedAt: new Date().toISOString() },
    });
    const globalIndex = composed.indexOf("OpenMock's interviewer");
    const definitionIndex = composed.indexOf("# Behavioral Interview");
    assert.ok(globalIndex >= 0);
    assert.ok(definitionIndex > globalIndex);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production prompt composition no longer exports the hardcoded constant", () => {
  const prompts = load("node:fs").readFileSync("src/lib/ai/prompts.ts", "utf8");
  assert.ok(!prompts.includes("BASE_INTERVIEWER_SYSTEM_PROMPT"));
});
