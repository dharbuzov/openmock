import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import type { InterviewContext, InterviewResult } from "../interview/types";
import type { AISettings } from "../settings/types";
import { getLanguageModel, AIConfigurationError } from "./model";

const definitionReferenceSchema = z.object({ id: z.string(), version: z.number().int().positive(), revision: z.string() });
const evidenceSchema = z.object({
  observation: z.string().trim().min(1).max(400),
  messageId: z.string().trim().min(1).optional(),
  stage: z.string().trim().min(1).optional(),
});
const competencySchema = z.object({
  competencyId: z.string().trim().min(1),
  rating: z.enum(["strong-positive", "positive", "mixed", "negative", "strong-negative", "not-assessed"]),
  summary: z.string().trim().min(1).max(600),
  evidence: z.array(evidenceSchema).max(8),
});

export const interviewResultSchema = z.object({
  interviewId: z.string().trim().min(1),
  problemId: z.string().trim().min(1),
  definition: definitionReferenceSchema,
  targetLevel: z.enum(["junior", "middle", "senior", "staff", "principal"]),
  recommendation: z.enum(["strong-hire", "hire", "mixed", "no-hire", "strong-no-hire"]),
  competencies: z.array(competencySchema),
  strengths: z.array(evidenceSchema).max(8),
  concerns: z.array(evidenceSchema).max(8),
  keyMoments: z.array(evidenceSchema).max(10),
  summary: z.string().trim().min(1).max(1_000),
  finalAssessment: z.string().trim().min(1).max(1_500),
  createdAt: z.string().datetime(),
});

const evaluatorOutputSchema = interviewResultSchema.omit({
  interviewId: true, problemId: true, definition: true, targetLevel: true, createdAt: true,
});

export class EvaluationError extends Error {
  constructor(message = "Could not evaluate the interview. Check your AI settings and try again.") {
    super(message);
    this.name = "EvaluationError";
  }
}

const EVALUATOR_PROMPT = `Evaluate the interview holistically using only supplied evidence and the definition's rubric.
Do not infer unobserved knowledge or claim workspace code was executed. Do not calculate the recommendation by averaging ratings.
Every assessed competency and meaningful conclusion must cite concise evidence. Use not-assessed when evidence is absent;
absence of evidence is not negative evidence. messageId values must reference supplied messages.`;

function validateResult(result: InterviewResult, context: InterviewContext): void {
  const competencyIds = new Set(context.definition.evaluation.competencies.map(({ id }) => id));
  const resultIds = result.competencies.map(({ competencyId }) => competencyId);
  if (resultIds.length !== competencyIds.size || resultIds.some((id) => !competencyIds.has(id)) || new Set(resultIds).size !== resultIds.length) {
    throw new EvaluationError();
  }
  if (!context.definition.evaluation.recommendations.includes(result.recommendation)) throw new EvaluationError();
  const messageIds = new Set(context.interview.messages.map(({ id }) => id));
  const evidence = [
    ...result.strengths, ...result.concerns, ...result.keyMoments,
    ...result.competencies.flatMap((competency) => competency.evidence),
  ];
  if (evidence.some((item) => item.messageId && !messageIds.has(item.messageId))) throw new EvaluationError();
  if (result.competencies.some((item) => item.rating === "not-assessed" && item.evidence.length > 0)) throw new EvaluationError();
}

export async function evaluateInterviewWithModel(model: LanguageModel, context: InterviewContext, signal?: AbortSignal): Promise<InterviewResult> {
  try {
    const result = await generateText({
      model,
      system: `${EVALUATOR_PROMPT}\n\nInterview instructions and rubric:\n${context.definition.instructions}`,
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
      output: Output.object({ schema: evaluatorOutputSchema, name: "interview_result", description: "Holistic, evidence-based interview feedback." }),
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

export async function evaluateInterview(settings: AISettings, context: InterviewContext, signal?: AbortSignal): Promise<InterviewResult> {
  try {
    return await evaluateInterviewWithModel(getLanguageModel(settings), context, signal);
  } catch (error) {
    if (error instanceof AIConfigurationError || error instanceof EvaluationError) throw error;
    throw new EvaluationError();
  }
}
