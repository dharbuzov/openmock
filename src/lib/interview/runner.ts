import { evaluationFailure } from "./evaluation-error";
import { logger } from "../logging/logger";
import { createTurnContext, type TurnContext } from "../logging/turn";
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
  opening = false,
  turnContext?: TurnContext,
): Promise<Interview> {
  if (
    interview.status !== "in-progress" ||
    (opening
      ? interview.messages.length !== 0
      : interview.messages.at(-1)?.role !== "candidate")
  )
    return interview;
  const metadata = {
    ...(turnContext ?? createTurnContext(interview.id)),
    component: "interview-engine",
    operation: "candidate-turn",
    interviewId: interview.id,
    stageId: interview.stage.current,
  };
  const started = performance.now();
  if (logger.isLevelEnabled("trace"))
    logger.trace(
      {
        ...metadata,
        interview,
        problem,
        definition,
        workspace: snapshot,
        opening,
      },
      "INTERVIEW_STATE_BEFORE",
    );
  logger.debug(
    metadata,
    opening ? "Interview opening requested" : "User turn received",
  );
  // The provider's Output.object Zod schema validates raw output before returning.
  try {
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
    const turn = await generateInterviewResponse(
      settings,
      context,
      signal,
      onMessage,
      metadata,
    );
    logger.debug(metadata, "AI response received");
    if (logger.isLevelEnabled("trace"))
      logger.trace(
        {
          ...metadata,
          decision: turn,
          appliedDecision: opening
            ? { ...turn, stageComplete: false, observations: [] }
            : turn,
        },
        "INTERVIEW_DECISION",
      );
    const updated = applyInterviewTurn(
      interview,
      definition,
      opening ? { ...turn, stageComplete: false, observations: [] } : turn,
    );
    logger.debug(metadata, "Interview turn applied");
    if (updated.stage.current !== interview.stage.current) {
      const transition = {
        ...metadata,
        previousStage: interview.stage.current,
        nextStage: updated.stage.current,
      };
      logger.debug(transition, "STAGE_TRANSITION");
      logger.info(transition, "Stage transitioned");
    }
    if (logger.isLevelEnabled("trace"))
      logger.trace(
        {
          ...metadata,
          previousStage: interview.stage.current,
          currentStage: updated.stage.current,
          interview: updated,
        },
        "INTERVIEW_STATE_AFTER",
      );
    logger.debug(
      { ...metadata, durationMs: Math.round(performance.now() - started) },
      "ENGINE_COMPLETED",
    );
    return updated;
  } catch (error) {
    logger.error(
      {
        ...metadata,
        provider: settings.provider,
        model: settings.model,
        err: error,
        durationMs: Math.round(performance.now() - started),
      },
      "ENGINE_FAILED",
    );
    throw error;
  }
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
        error: evaluationFailure(error, {
          provider: settings.provider,
          model: settings.model,
        }),
      },
    };
  }
}
