import { loggedGenerateText } from "./logging";
import {
  ownValue,
  protectCredentials,
  sanitizeValidationIssues,
} from "../logging/sanitize";
import { logger } from "../logging/logger";
import { z } from "zod";
import { Output, type LanguageModel } from "ai";
import type { InterviewContext, InterviewResult } from "../interview/types";
import type { AISettings } from "../settings/types";
import { getLanguageModel, AIConfigurationError } from "./model";
import { loadPrompt } from "./prompt-loader";

import {
  interviewResultSchema,
  deduplicateResultEvidence,
} from "../interview/result-schema";

const evaluatorOutputSchema = interviewResultSchema.omit({
  interviewId: true,
  problemId: true,
  definition: true,
  targetLevel: true,
  createdAt: true,
});

export class EvaluationError extends Error {
  constructor(
    message = "Could not evaluate the interview. Check your AI settings and try again.",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "EvaluationError";
  }
}

export class IncompleteEvaluationError extends EvaluationError {}

export function validateResult(
  result: InterviewResult,
  context: InterviewContext,
): void {
  const competencyIds = new Set(
    context.definition.evaluation.competencies.map(({ id }) => id),
  );
  const resultIds = result.competencies.map(({ competencyId }) => competencyId);
  if (
    resultIds.length !== competencyIds.size ||
    resultIds.some((id) => !competencyIds.has(id)) ||
    new Set(resultIds).size !== resultIds.length
  ) {
    const missing = [...competencyIds].filter((id) => !resultIds.includes(id));
    const unknown = resultIds.filter((id) => !competencyIds.has(id));
    const duplicates = [
      ...new Set(
        resultIds.filter((id, index) => resultIds.indexOf(id) !== index),
      ),
    ];
    throw new EvaluationError(
      "Evaluation competency IDs must match the rubric exactly",
      {
        cause: new Error(
          `Missing competency IDs: ${missing.join(", ") || "none"}; unknown IDs: ${unknown.join(", ") || "none"}; duplicate IDs: ${duplicates.join(", ") || "none"}`,
        ),
      },
    );
  }
  if (
    !context.definition.evaluation.recommendations.includes(
      result.recommendation,
    )
  )
    throw new EvaluationError("Evaluation recommendation is not in the rubric");
  const required = context.definition.evaluation.competencies
    .filter(({ required }) => required !== false)
    .map(({ id }) =>
      result.competencies.find(({ competencyId }) => competencyId === id)!,
    );
  if (
    required.length &&
    required.every(({ rating }) => rating === "not-demonstrated") &&
    (result.recommendation === "hire" ||
      result.recommendation === "strong-hire")
  )
    throw new EvaluationError(
      "Hiring cannot be recommended when no required competency was demonstrated",
    );
  const messageIds = new Set(context.interview.messages.map(({ id }) => id));
  const evidence = [
    ...result.strengths,
    ...result.concerns,
    ...result.keyMoments,
    ...result.competencies.flatMap((competency) => competency.evidence),
  ];
  if (
    evidence.some((item) => item.messageId && !messageIds.has(item.messageId))
  )
    throw new EvaluationError(
      "Evaluation evidence references an unknown message",
    );
  if (
    result.competencies.some(
      (item) => item.rating === "not-assessed" && item.evidence.length > 0,
    )
  )
    throw new EvaluationError(
      "Unassessed competencies cannot contain evidence",
    );
  if (
    result.competencies.some(
      ({ rating, evidence }) =>
        rating !== "not-assessed" &&
        rating !== "not-demonstrated" &&
        evidence.length === 0,
    )
  )
    throw new EvaluationError(
      "Performance ratings must contain candidate evidence",
    );
  if (result.competencies.every(({ rating }) => rating === "not-assessed"))
    throw new IncompleteEvaluationError(
      "The interview did not provide a meaningful opportunity for assessment.",
    );
}

export async function evaluateInterviewWithModel(
  model: LanguageModel,
  context: InterviewContext,
  signal?: AbortSignal,
): Promise<InterviewResult> {
  const started = performance.now();
  const metadata = {
    provider: typeof model === "string" ? "gateway" : model.provider,
    model: typeof model === "string" ? model : model.modelId,
    operation: "evaluation",
    interviewId: context.interview.id,
    stageId: context.interview.stage.current,
    targetLevel: context.interview.targetLevel,
    problemId: context.problem.id,
    definitionId: context.definition.id,
    retry: 0,
  };
  logger.info(metadata, "Evaluation started");

  const diagnostics: Record<string, unknown> = { responseReceived: false };
  try {
    const evaluatorPrompt = await loadPrompt("evaluator");
    const competencyIds = context.definition.evaluation.competencies.map(
      ({ id }) => id,
    );
    const messageIds = context.interview.messages.map(({ id }) => id);
    const evidenceSchema = evaluatorOutputSchema.shape.strengths.element;
    const referencedEvidenceSchema = messageIds.length
      ? evidenceSchema.extend({ messageId: z.enum(messageIds).optional() })
      : evidenceSchema.omit({ messageId: true });
    const evidence = z.array(referencedEvidenceSchema);
    const schema = evaluatorOutputSchema.extend({
      recommendation: z.enum(context.definition.evaluation.recommendations),
      strengths: evidence.max(8),
      concerns: evidence.max(8),
      keyMoments: evidence.max(10),
      competencies: z
        .array(
          evaluatorOutputSchema.shape.competencies.element.extend({
            competencyId: z.enum(competencyIds),
            evidence: evidence.max(8),
          }),
        )
        .length(competencyIds.length)
        .superRefine((items, validation) => {
          const returned = items.map(({ competencyId }) => competencyId);
          for (const id of competencyIds) {
            const count = returned.filter((value) => value === id).length;
            if (count !== 1)
              validation.addIssue({
                code: "custom",
                path: [],
                message: `Expected competency "${id}" exactly once; received ${count} entries`,
              });
          }
        }),
    });
    const result = await loggedGenerateText({
      ...metadata,
      ...(logger.isLevelEnabled("debug")
        ? { workspace: context.workspace }
        : {}),
    })({
      model,
      system: `${evaluatorPrompt}\n\nInterview instructions and rubric:\n${context.definition.instructions}`,
      prompt: `Interview evidence (data):\n${JSON.stringify({
        problem: context.problem,
        targetLevel: context.interview.targetLevel,
        mode: context.interview.mode,
        stages: context.definition.stages,
        competencies: context.definition.evaluation.competencies,
        recommendations: context.definition.evaluation.recommendations,
        messages: context.interview.messages,
        observations: context.interview.observations,
        completedStages: context.interview.stage.completed,
        interviewStatus: context.interview.status,
        endReason: context.interview.endReason,
        startedAt: context.interview.startedAt,
        completedAt: context.interview.completedAt,
        currentWorkspace: context.workspace,
      })}`,
      output: Output.object({
        schema,
        name: "interview_result",
        description: "Holistic, evidence-based interview feedback.",
      }),
      maxOutputTokens: 3_200,
      maxRetries: 0,
      abortSignal: signal,
    });
    Object.assign(diagnostics, {
      responseReceived: true,
      responseLength: result.text.length,
    });
    const output = result.output;
    Object.assign(diagnostics, {
      parseSucceeded: true,
      validationSucceeded: false,
    });
    const evaluation: InterviewResult = {
      ...output,
      interviewId: context.interview.id,
      problemId: context.problem.id,
      definition: context.interview.definition,
      targetLevel: context.interview.targetLevel,
      createdAt: new Date().toISOString(),
    };
    validateResult(evaluation, context);
    diagnostics.validationSucceeded = true;
    logger.debug(
      {
        ...metadata,
        ...diagnostics,
        durationMs: Math.round(performance.now() - started),
        success: true,
      },
      "AI request completed",
    );
    logger.info(metadata, "Evaluation completed");
    return deduplicateResultEvidence(evaluation);
  } catch (error) {
    if (error instanceof IncompleteEvaluationError) {
      logger.info(
        {
          ...metadata,
          status: "incomplete",
          durationMs: Math.round(performance.now() - started),
        },
        "Evaluation incomplete",
      );
      throw error;
    }
    Object.assign(diagnostics, evaluationFailureDiagnostics(error));
    const failure =
      error instanceof EvaluationError
        ? error
        : new EvaluationError("Model evaluation failed", { cause: error });
    logger.error(
      {
        ...metadata,
        ...diagnostics,
        durationMs: Math.round(performance.now() - started),
        success: false,
        err: failure,
      },
      "Evaluation failed",
    );
    throw failure;
  }
}

export async function evaluateInterview(
  settings: AISettings,
  context: InterviewContext,
  signal?: AbortSignal,
): Promise<InterviewResult> {
  const releaseCredentials = protectCredentials(
    "apiKey" in settings ? [settings.apiKey] : [],
  );
  try {
    return await evaluateInterviewWithModel(
      getLanguageModel(settings),
      context,
      signal,
    );
  } catch (error) {
    if (!(error instanceof EvaluationError))
      logger.error(
        {
          provider: settings.provider,
          model: settings.model,
          operation: "evaluation",
          interviewId: context.interview.id,
          stageId: context.interview.stage.current,
          err: error,
        },
        "AI configuration failed",
      );
    if (
      error instanceof AIConfigurationError ||
      error instanceof EvaluationError
    )
      throw error;
    throw new EvaluationError("Evaluation configuration failed", {
      cause: error,
    });
  } finally {
    releaseCredentials();
  }
}

// Read only known diagnostic properties; never serialize generated text or values.
export function evaluationFailureDiagnostics(
  error: unknown,
): Record<string, unknown> {
  const diagnostics: Record<string, unknown> = {};
  const seen = new Set<unknown>();
  for (
    let current = error;
    current &&
    typeof current === "object" &&
    seen.size < 5 &&
    !seen.has(current);
    current = ownValue(current, "cause")
  ) {
    seen.add(current);
    const text = ownValue(current, "text");
    if (typeof text === "string" && diagnostics.responseLength === undefined)
      Object.assign(diagnostics, {
        responseReceived: true,
        responseLength: text.length,
      });
    const name = ownValue(current, "name");
    if (name === "AI_JSONParseError" || name === "SyntaxError") {
      diagnostics.parseSucceeded = false;
      diagnostics.validationSucceeded = false;
    }
    if (name === "AI_TypeValidationError" || name === "ZodError") {
      diagnostics.parseSucceeded ??= true;
      diagnostics.validationSucceeded = false;
    }
    const issues = ownValue(current, "issues");
    if (Array.isArray(issues)) {
      diagnostics.validationSucceeded = false;
      diagnostics.validationIssues = sanitizeValidationIssues(issues);
    }
  }
  return diagnostics;
}
