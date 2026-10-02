import { z } from "zod";
import {
  interviewLevelIds,
  hiringRecommendations,
  competencyRatings,
} from "./types";
import type { InterviewResult, EvaluationEvidence } from "./types";

const definitionReferenceSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  revision: z.string(),
});
const evidenceSchema = z.object({
  observation: z.string().trim().min(1).max(400),
  messageId: z.string().trim().min(1).optional(),
  stage: z.string().trim().min(1).optional(),
});
const competencySchema = z.object({
  competencyId: z.string().trim().min(1),
  rating: z.enum(competencyRatings),
  summary: z.string().trim().min(1).max(600),
  evidence: z.array(evidenceSchema).max(8),
});

export const interviewResultSchema = z.object({
  interviewId: z.string().trim().min(1),
  problemId: z.string().trim().min(1),
  definition: definitionReferenceSchema,
  targetLevel: z.enum(interviewLevelIds),
  recommendation: z.enum(hiringRecommendations),
  competencies: z.array(competencySchema),
  strengths: z.array(evidenceSchema).max(8),
  concerns: z.array(evidenceSchema).max(8),
  keyMoments: z.array(evidenceSchema).max(10),
  summary: z.string().trim().min(1).max(1_000),
  finalAssessment: z
    .string()
    .trim()
    .min(1)
    .max(1_500)
    .refine(
      (value) =>
        !hiringRecommendations.some(
          (recommendation) => recommendation === value,
        ),
      "Final assessment must explain the recommendation, not repeat its enum value",
    ),
  createdAt: z.string().datetime(),
});

export function deduplicateResultEvidence(
  result: InterviewResult,
): InterviewResult {
  function unique(items: EvaluationEvidence[]): EvaluationEvidence[] {
    const seen = new Set<string>();
    return items.filter(({ observation, messageId, stage }) => {
      const key = JSON.stringify([
        observation.trim(),
        messageId?.trim() ?? null,
        stage?.trim() ?? null,
      ]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return {
    ...result,
    competencies: result.competencies.map((item) => ({
      ...item,
      evidence: unique(item.evidence),
    })),
    strengths: unique(result.strengths),
    concerns: unique(result.concerns),
    keyMoments: unique(result.keyMoments),
  };
}
