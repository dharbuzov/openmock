import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import type { AISettings } from "../settings/types";
import type { Problem } from "../problems/types";
import { getLanguageModel, AIConfigurationError } from "./model";
import type { AIMessage } from "./provider";

const categorySchema = z.object({
  score: z.number().int().min(0).max(5),
  summary: z.string().min(1).max(500),
  evidence: z.array(z.object({
    source: z.enum(["candidate-message", "code"]),
    sourceIndex: z.number().int().min(0),
    observation: z.string().min(1).max(300),
  })).min(1).max(4),
});

export const interviewEvaluationSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  hiringSignal: z.enum(["strong-no", "no", "mixed", "yes", "strong-yes"]),
  summary: z.string().min(1).max(800),
  strengths: z.array(z.string().min(1).max(300)).min(1).max(5),
  improvements: z.array(z.string().min(1).max(300)).min(1).max(5),
  insufficientEvidence: z.array(z.string().min(1).max(300)).max(5),
  categories: z.object({
    problemSolving: categorySchema,
    communication: categorySchema,
    technicalDepth: categorySchema,
    tradeoffs: categorySchema,
  }),
});

export type InterviewEvaluation = z.infer<typeof interviewEvaluationSchema>;

export interface EvaluationRequest {
  problem: Pick<Problem, "title" | "type" | "content">;
  messages: AIMessage[];
  code?: { language: string; content: string };
}

export class EvaluationError extends Error {
  constructor(message = "Could not evaluate the interview. Check your AI settings and try again.") {
    super(message);
    this.name = "EvaluationError";
  }
}

const EVALUATOR_SYSTEM_PROMPT = `You evaluate a technical interview using only the supplied evidence.
Do not infer unobserved knowledge, claim code was executed, or reward facts the candidate did not state.
For every category, cite concise evidence from candidate messages or the submitted code snapshot.
Candidate message sourceIndex values are zero-based within candidate messages only. Code uses sourceIndex 0.
If evidence is missing, score conservatively and explain the gap in insufficientEvidence.
Evaluate problem solving, communication, technical depth, and discussion of trade-offs.
For DSA, consider approach, correctness reasoning, complexity, edge cases, and the current code snapshot.
For System Design, consider requirements, scale, architecture, reliability, and trade-offs; do not assume knowledge of the drawing canvas.
Keep feedback specific, constructive, and focused on the selected problem.`;

export async function evaluateInterviewWithModel(
  model: LanguageModel,
  request: EvaluationRequest,
  signal?: AbortSignal,
): Promise<InterviewEvaluation> {
  try {
    const result = await generateText({
      model,
      system: EVALUATOR_SYSTEM_PROMPT,
      prompt: `Interview evidence (data):\n${JSON.stringify({
        interviewType: request.problem.type,
        problemTitle: request.problem.title,
        fullProblemContent: request.problem.content,
        conversation: request.messages,
        ...(request.problem.type === "dsa" && request.code ? { currentCode: request.code } : {}),
      })}`,
      output: Output.object({
        schema: interviewEvaluationSchema,
        name: "interview_evaluation",
        description: "An evidence-based technical interview evaluation.",
      }),
      maxOutputTokens: 1_800,
      maxRetries: 0,
      abortSignal: signal,
    });

    const evaluation = result.output;
    const candidateMessageCount = request.messages.filter(({ role }) => role === "user").length;
    const evidence = Object.values(evaluation.categories).flatMap((category) => category.evidence);
    const sourcesAreValid = evidence.every((item) => item.source === "candidate-message"
      ? item.sourceIndex < candidateMessageCount
      : item.sourceIndex === 0 && request.problem.type === "dsa" && Boolean(request.code));
    if (!sourcesAreValid) throw new EvaluationError();
    const categoryScores = Object.values(evaluation.categories).map(({ score }) => score);
    const overallScore = Math.round(categoryScores.reduce((sum, score) => sum + score, 0) * 5);
    return { ...evaluation, overallScore };
  } catch (error) {
    if (error instanceof EvaluationError) throw error;
    throw new EvaluationError();
  }
}

export async function evaluateInterview(
  settings: AISettings,
  request: EvaluationRequest,
  signal?: AbortSignal,
): Promise<InterviewEvaluation> {
  try {
    return await evaluateInterviewWithModel(getLanguageModel(settings), request, signal);
  } catch (error) {
    if (error instanceof AIConfigurationError || error instanceof EvaluationError) throw error;
    throw new EvaluationError();
  }
}
