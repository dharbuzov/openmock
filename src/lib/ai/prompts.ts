import type { InterviewContext } from "../interview/types";
import { interviewTiming } from "../interview/engine";
import { loadPrompt } from "./prompt-loader";

export async function interviewerSystemPrompt(
  context: InterviewContext,
  logContext: Record<string, unknown> = {},
): Promise<string> {
  return `${await loadPrompt("interviewer", logContext)}\n\n${context.definition.instructions}

Next turn task: Respond to the candidate as the interviewer, using the Flow for
the active stage ${JSON.stringify(context.interview.stage.current)}. The engine's
approved transition is ${JSON.stringify(context.transition ?? null)}.
If there is no approved transition, ask within the active stage and do not
announce another stage. If its objective is sufficiently explored, recommend
readiness with stageComplete true; the engine will request the next stage's reply.
Keep the candidate's answer and your evidence separate from your spoken message.`;
}

export function interviewContext(context: InterviewContext): string {
  const timing = interviewTiming(context.interview, context.definition);
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
    transition: context.transition,
    stagePosition: timing.index + 1,
    totalStageCount: context.definition.stages.length,
    remainingStages: context.definition.stages.slice(timing.index + 1),
    time: {
      totalMinutes: timing.durationMs / 60_000,
      elapsedMinutes: timing.elapsedMs / 60_000,
      remainingMinutes: timing.remainingMs / 60_000,
      stageElapsedMinutes: timing.stageElapsedMs / 60_000,
      stageAllowanceMinutes: timing.allowanceMs / 60_000,
      stageLimitMinutes: timing.stageLimitMs / 60_000,
    },
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
