import { logger } from "../logging/logger";
import type { Problem } from "../problems/types";
import type { AISettings } from "../settings/types";
import {
  applyInterviewTurn,
  buildInterviewContext,
  completeInterview,
  InterviewStateError,
} from "./engine";
import type {
  FinishedInterview,
  Interview,
  InterviewDefinition,
  WorkspaceSnapshot,
} from "./types";

export async function processCandidateMessage(
  settings: AISettings,
  interview: Interview,
  problem: Problem,
  definition: InterviewDefinition,
  snapshot?: WorkspaceSnapshot,
  signal?: AbortSignal,
  onMessage?: (message: string) => void,
): Promise<Interview> {
  if (
    interview.status !== "in-progress" ||
    interview.messages.at(-1)?.role !== "candidate"
  )
    return interview;
  if (interview.stage.current === null)
    throw new InterviewStateError("No active interview stage.");
  const context = buildInterviewContext(
    interview,
    problem,
    definition,
    snapshot,
  );
  if (!definition.stages.some(({ id }) => id === interview.stage.current))
    throw new InterviewStateError("Unknown current interview stage.");
  const { generateInterviewResponse } = await import("../ai/provider");
  const metadata = {
    interviewId: interview.id,
    stageId: interview.stage.current,
  };
  logger.debug(metadata, "User turn received");
  // The provider's Output.object Zod schema validates raw output before returning.
  const turn = await generateInterviewResponse(
    settings,
    context,
    signal,
    onMessage,
  );
  logger.debug(metadata, "AI response received");
  const updated = applyInterviewTurn(interview, definition, turn);
  logger.debug(metadata, "Interview turn applied");
  if (updated.stage.current !== interview.stage.current)
    logger.debug(
      { ...metadata, nextStage: updated.stage.current },
      "Stage transitioned",
    );
  return updated;
}

export async function finishInterview(
  settings: AISettings,
  interview: Interview,
  problem: Problem,
  definition: InterviewDefinition,
  snapshot?: WorkspaceSnapshot,
  signal?: AbortSignal,
  onCompleted?: (interview: Interview) => void,
): Promise<FinishedInterview> {
  // Validate identity and workspace before committing a domain transition.
  buildInterviewContext(interview, problem, definition, snapshot);
  const completed = completeInterview(interview);
  logger.info(
    { interviewId: completed.id, problemId: problem.id },
    "Interview completed",
  );
  onCompleted?.(completed);
  return retryEvaluation(
    settings,
    completed,
    problem,
    definition,
    snapshot,
    signal,
  );
}

export async function retryEvaluation(
  settings: AISettings,
  interview: Interview,
  problem: Problem,
  definition: InterviewDefinition,
  snapshot?: WorkspaceSnapshot,
  signal?: AbortSignal,
): Promise<FinishedInterview> {
  if (interview.status !== "completed")
    throw new InterviewStateError(
      "Only a completed interview can be evaluated.",
    );
  const context = buildInterviewContext(
    interview,
    problem,
    definition,
    snapshot,
  );
  try {
    const { evaluateInterview } = await import("../ai/evaluation");
    const result = await evaluateInterview(settings, context, signal);
    return { interview, evaluation: { status: "completed", result } };
  } catch (error) {
    const { IncompleteEvaluationError } = await import("../ai/evaluation");
    if (error instanceof IncompleteEvaluationError)
      return {
        interview,
        evaluation: { status: "incomplete", reason: error.message },
      };
    // Detailed errors belong to the AI boundary. This result is safe for UI/storage.
    return {
      interview,
      evaluation: {
        status: "failed",
        error: {
          name: "EvaluationError",
          message:
            "Evaluation failed. Check your AI settings and retry evaluation.",
        },
      },
    };
  }
}
