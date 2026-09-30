import { interviewResultSchema } from "../ai/evaluation";
import type { InterviewResult } from "./types";

function storageKey(interviewId: string): string {
  return `openmock:interview-result:v3:${interviewId}`;
}

export function saveEvaluation(evaluation: InterviewResult): void {
  sessionStorage.setItem(storageKey(evaluation.interviewId), JSON.stringify(evaluation));
}

export function readEvaluationValue(interviewId: string): string | null {
  try { return sessionStorage.getItem(storageKey(interviewId)); } catch { return null; }
}

export function parseEvaluation(value: string | null): InterviewResult | null {
  if (!value) return null;
  try {
    const parsed = interviewResultSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}
