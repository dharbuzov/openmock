import { logger } from "../logging/logger";
import { deserialize, sessionStorage } from "../storage/local-storage";
import type { Storage } from "../storage/storage";
import {
  interviewResultSchema,
  deduplicateResultEvidence,
} from "./result-schema";
import type { InterviewResult } from "./types";
import { z } from "zod";
import type { FinishedInterview, InterviewDefinition } from "./types";
import type { Problem } from "../problems/types";

const resultsRecordSchema = z.object({
  context: z.object({
    problemTitle: z.string(),
    definitionName: z.string(),
    levelName: z.string(),
    competencies: z.array(z.object({ id: z.string(), name: z.string() })),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
    endReason: z
      .enum([
        "completed",
        "candidate-finished",
        "time-limit",
        "abandoned",
        "error",
      ])
      .optional(),
  }),
  evaluation: z.discriminatedUnion("status", [
    z.object({ status: z.literal("completed"), result: interviewResultSchema }),
    z.object({
      status: z.literal("failed"),
      error: z.object({
        name: z.literal("EvaluationError"),
        message: z.string(),
      }),
    }),
    z.object({ status: z.literal("incomplete"), reason: z.string() }),
  ]),
});
export type ResultsRecord = z.infer<typeof resultsRecordSchema>;

export function saveResultsRecord(
  finished: FinishedInterview,
  problem: Problem,
  definition: InterviewDefinition,
): void {
  const record: ResultsRecord = {
    context: {
      problemTitle: problem.title,
      definitionName: definition.name,
      levelName: definition.levels.find(
        ({ id }) => id === finished.interview.targetLevel,
      )!.name,
      competencies: definition.evaluation.competencies.map(({ id, name }) => ({
        id,
        name,
      })),
      startedAt: finished.interview.startedAt,
      completedAt: finished.interview.completedAt,
      endReason: finished.interview.endReason,
    },
    evaluation:
      finished.evaluation.status === "completed"
        ? {
            ...finished.evaluation,
            result: deduplicateResultEvidence(finished.evaluation.result),
          }
        : finished.evaluation,
  };
  sessionStorage.set(
    `openmock:results:v1:${finished.interview.id}`,
    resultsRecordSchema.parse(record),
  );
}

export function readResultsRecordValue(interviewId: string): string | null {
  try {
    return sessionStorage.getText(`openmock:results:v1:${interviewId}`);
  } catch {
    return null;
  }
}

export function parseResultsRecord(value: string | null): ResultsRecord | null {
  if (!value) return null;
  try {
    const parsed = resultsRecordSchema.safeParse(deserialize<unknown>(value));
    if (!parsed.success) return null;
    const record = parsed.data;
    if (record.evaluation.status === "completed")
      record.evaluation.result = deduplicateResultEvidence(
        record.evaluation.result,
      );
    return record;
  } catch {
    return null;
  }
}

function storageKey(interviewId: string): string {
  return `openmock:interview-result:v3:${interviewId}`;
}

export function saveEvaluation(
  evaluation: InterviewResult,
  storage: Storage = sessionStorage,
): void {
  storage.set(storageKey(evaluation.interviewId), evaluation);
}

export function readEvaluationValue(
  interviewId: string,
  storage: Storage = sessionStorage,
): string | null {
  try {
    return storage.getText(storageKey(interviewId));
  } catch {
    logger.warn(
      { operation: "storage", reason: "unavailable-or-invalid" },
      "Storage operation failed",
    );
    return null;
  }
}

export function parseEvaluation(value: string | null): InterviewResult | null {
  if (!value) return null;
  try {
    const parsed = interviewResultSchema.safeParse(deserialize<unknown>(value));
    return parsed.success ? parsed.data : null;
  } catch {
    logger.warn(
      { operation: "storage", reason: "unavailable-or-invalid" },
      "Storage operation failed",
    );
    return null;
  }
}
