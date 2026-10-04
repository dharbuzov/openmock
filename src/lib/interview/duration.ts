import type { ProblemMetadata } from "../problems/types";
import type { InterviewDefinition } from "./types";

export function resolveInterviewDuration(
  problem: Pick<ProblemMetadata, "duration">,
  definition: Pick<InterviewDefinition, "duration">,
  capturedMinutes?: number,
): number {
  return (
    capturedMinutes ??
    problem.duration?.minutes ??
    definition.duration.defaultMinutes
  );
}
