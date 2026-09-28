import { interviewEvaluationSchema, type InterviewEvaluation } from "../ai/evaluation";

function storageKey(interviewId: string): string {
  return `openmock:interview-evaluation:v2:${interviewId}`;
}

export function saveEvaluation(interviewId: string, evaluation: InterviewEvaluation): void {
  sessionStorage.setItem(storageKey(interviewId), JSON.stringify(evaluation));
}

export function readEvaluationValue(interviewId: string): string | null {
  try {
    return sessionStorage.getItem(storageKey(interviewId));
  } catch {
    return null;
  }
}

export function parseEvaluation(value: string | null): InterviewEvaluation | null {
  if (!value) return null;
  try {
    const parsed = interviewEvaluationSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
