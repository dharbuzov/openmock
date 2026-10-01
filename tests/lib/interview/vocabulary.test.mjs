import { test } from "node:test";
import assert from "node:assert/strict";
import { load } from "../../register-typescript.mjs";
import { loadDefinition } from "../../content-fixtures.mjs";

const {
  interviewLevelIds,
  interviewModes,
  workspaceTypes,
  hiringRecommendations,
  competencyRatings,
} = load("../src/lib/interview/types.ts");
const { parseInterviewDefinitionDocument } = load(
  "../src/lib/interview/definition-schema.ts",
);
const { interviewResultSchema } = load("../src/lib/interview/result-schema.ts");
const definition = loadDefinition("behavioral");

test("definition parsing accepts the domain vocabulary and rejects unsupported values", () => {
  const metadata = {
    ...definition,
    stages: definition.stages.map(({ id }) => id),
    levels: interviewLevelIds,
    modes: interviewModes,
    evaluation: {
      ...definition.evaluation,
      recommendations: hiringRecommendations,
    },
  };
  const parse = (value) =>
    parseInterviewDefinitionDocument(
      `---\n${JSON.stringify(value)}\n---\nInstructions`,
    );
  for (const workspace of workspaceTypes) {
    const parsed = parse({ ...metadata, workspace });
    assert.equal(parsed.workspace, workspace);
    assert.deepEqual(
      parsed.levels.map(({ id }) => id),
      interviewLevelIds,
    );
    assert.deepEqual(parsed.modes, interviewModes);
    assert.deepEqual(parsed.evaluation.recommendations, hiringRecommendations);
  }
  for (const invalid of [
    { levels: ["unsupported"] },
    { modes: ["unsupported"] },
    { workspace: "unsupported" },
    {
      evaluation: { ...metadata.evaluation, recommendations: ["unsupported"] },
    },
  ])
    assert.throws(() => parse({ ...metadata, ...invalid }));
});

test("saved result validation accepts every domain level, recommendation and competency rating", () => {
  const result = {
    interviewId: "example",
    problemId: "example",
    definition: {
      id: definition.id,
      version: 1,
      revision: definition.revision,
    },
    targetLevel: "senior",
    recommendation: "mixed",
    competencies: [
      {
        competencyId: "communication",
        rating: "not-assessed",
        summary: "Summary",
        evidence: [],
      },
    ],
    strengths: [],
    concerns: [],
    keyMoments: [],
    summary: "Summary",
    finalAssessment: "Assessment",
    createdAt: "2026-10-01T12:00:00.000Z",
  };
  for (const targetLevel of interviewLevelIds)
    assert.equal(
      interviewResultSchema.parse({ ...result, targetLevel }).targetLevel,
      targetLevel,
    );
  for (const recommendation of hiringRecommendations)
    assert.equal(
      interviewResultSchema.parse({ ...result, recommendation }).recommendation,
      recommendation,
    );
  for (const rating of competencyRatings) {
    const parsed = interviewResultSchema.parse({
      ...result,
      competencies: [{ ...result.competencies[0], rating }],
    });
    assert.equal(parsed.competencies[0].rating, rating);
  }
  for (const invalid of [
    { targetLevel: "unsupported" },
    { recommendation: "unsupported" },
    { competencies: [{ ...result.competencies[0], rating: "unsupported" }] },
  ])
    assert.equal(
      interviewResultSchema.safeParse({ ...result, ...invalid }).success,
      false,
    );
});
