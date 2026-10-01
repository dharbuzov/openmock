import {
  deserialize,
  sessionStorage,
  sessionTextStorage,
} from "../storage/local-storage";
import type { Storage } from "../storage/storage";
import { interviewResultSchema } from "../ai/evaluation";
import type { InterviewResult } from "./types";

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
  storage: Storage = sessionTextStorage,
): string | null {
  try {
    return storage.get<string>(storageKey(interviewId));
  } catch {
    return null;
  }
}

export function parseEvaluation(value: string | null): InterviewResult | null {
  if (!value) return null;
  try {
    const parsed = interviewResultSchema.safeParse(deserialize<unknown>(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
