import { generateText, Output, type LanguageModel } from "ai";
import type { InterviewContext, InterviewResult } from "../interview/types";
import type { AISettings } from "../settings/types";
import { getLanguageModel, AIConfigurationError } from "./model";
import { loadPrompt } from "./prompt-loader";

import { interviewResultSchema } from "../interview/result-schema";

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
  ) {
    super(message);
    this.name = "EvaluationError";
  }
}

function validateResult(
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
    throw new EvaluationError();
  }
  if (
    !context.definition.evaluation.recommendations.includes(
      result.recommendation,
    )
  )
    throw new EvaluationError();
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
    throw new EvaluationError();
  if (
    result.competencies.some(
      (item) => item.rating === "not-assessed" && item.evidence.length > 0,
    )
  )
    throw new EvaluationError();
}

export async function evaluateInterviewWithModel(
  model: LanguageModel,
  context: InterviewContext,
  signal?: AbortSignal,
): Promise<InterviewResult> {
  try {
    const evaluatorPrompt = await loadPrompt("evaluator");
    const result = await generateText({
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
        currentWorkspace: context.workspace,
      })}`,
      output: Output.object({
        schema: evaluatorOutputSchema,
        name: "interview_result",
        description: "Holistic, evidence-based interview feedback.",
      }),
      maxOutputTokens: 3_200,
      maxRetries: 0,
      abortSignal: signal,
    });
    const evaluation: InterviewResult = {
      ...result.output,
      interviewId: context.interview.id,
      problemId: context.problem.id,
      definition: context.interview.definition,
      targetLevel: context.interview.targetLevel,
      createdAt: new Date().toISOString(),
    };
    validateResult(evaluation, context);
    return evaluation;
  } catch (error) {
    if (error instanceof EvaluationError) throw error;
    throw new EvaluationError();
  }
}

export async function evaluateInterview(
  settings: AISettings,
  context: InterviewContext,
  signal?: AbortSignal,
): Promise<InterviewResult> {
  try {
    return await evaluateInterviewWithModel(
      getLanguageModel(settings),
      context,
      signal,
    );
  } catch (error) {
    if (
      error instanceof AIConfigurationError ||
      error instanceof EvaluationError
    )
      throw error;
    throw new EvaluationError();
  }
}
