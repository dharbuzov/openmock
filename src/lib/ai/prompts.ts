import type { InterviewContext } from "../interview/types";
import { resolveInterviewDuration } from "../interview/duration";
import { loadPrompt } from "./prompt-loader";

export async function interviewerSystemPrompt(
  context: InterviewContext,
  logContext: Record<string, unknown> = {},
): Promise<string> {
  return `${await loadPrompt("interviewer", logContext)}\n\n${context.definition.instructions}`;
}

export function interviewContext(context: InterviewContext): string {
  const elapsedMinutes = Math.max(
    0,
    Math.floor(
      (context.interview.elapsedMs ??
        Date.now() - Date.parse(context.interview.startedAt)) / 60_000,
    ),
  );
  const remainingMinutes = Math.max(
    0,
    resolveInterviewDuration(
      context.problem,
      context.definition,
      context.interview.durationMinutes,
    ) - elapsedMinutes,
  );
  return JSON.stringify({
    interviewDefinition: {
      id: context.definition.id,
      name: context.definition.name,
      version: context.definition.version,
      stages: context.definition.stages,
      competencies: context.definition.evaluation.competencies,
    },
    targetLevel: context.interview.targetLevel,
    mode: context.interview.mode,
    currentStage: context.interview.stage,
    time: { elapsedMinutes, remainingMinutes },
    problem: {
      id: context.problem.id,
      title: context.problem.title,
      difficulty: context.problem.difficulty,
      categories: context.problem.categories,
      topics: context.problem.topics,
      content: context.problem.content,
      interviewerContext: context.problem.interviewerContext,
    },
    priorObservations: context.interview.observations,
    currentWorkspace: context.workspace,
  });
}
