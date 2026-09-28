import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import type { AISettings } from "../settings/types";
import type { Problem } from "../problems/types";
import type { ArchitectureDiagram } from "../diagram/types";
import type { SystemDesignState } from "../interview/system-design";
import { getLanguageModel, AIConfigurationError } from "./model";
import type { AIMessage } from "./provider";

const evidenceSchema = z.object({
  source: z.enum(["candidate-message", "code", "diagram"]),
  sourceIndex: z.number().int().min(0),
  observation: z.string().min(1).max(300),
});

const scoredCategorySchema = z.object({
  score: z.number().int().min(0).max(5),
  summary: z.string().min(1).max(500),
  evidence: z.array(evidenceSchema).min(1).max(4),
});

const qualitativeCategorySchema = z.object({
  level: z.enum(["needs-improvement", "developing", "strong", "very-strong"]),
  summary: z.string().min(1).max(500),
  evidence: z.array(evidenceSchema).min(1).max(4),
});

const commonEvaluationFields = {
  hiringSignal: z.enum(["strong-no", "no", "mixed", "yes", "strong-yes"]),
  summary: z.string().min(1).max(800),
  strengths: z.array(z.string().min(1).max(300)).min(1).max(5),
  improvements: z.array(z.string().min(1).max(300)).min(1).max(5),
  insufficientEvidence: z.array(z.string().min(1).max(300)).max(7),
};

export const dsaEvaluationSchema = z.object({
  interviewType: z.literal("dsa"),
  overallScore: z.number().int().min(0).max(100),
  ...commonEvaluationFields,
  categories: z.object({
    problemSolving: scoredCategorySchema,
    communication: scoredCategorySchema,
    technicalDepth: scoredCategorySchema,
    tradeoffs: scoredCategorySchema,
  }),
});

const keyMomentSchema = z.object({
  kind: z.enum(["strength", "improvement", "tradeoff"]),
  summary: z.string().min(1).max(300),
  evidence: z.array(evidenceSchema).min(1).max(3),
});

export const systemDesignEvaluationSchema = z.object({
  interviewType: z.literal("system-design"),
  ...commonEvaluationFields,
  keyMoments: z.array(keyMomentSchema).min(1).max(6),
  categories: z.object({
    requirementsAndScope: qualitativeCategorySchema,
    architecture: qualitativeCategorySchema,
    dataAndState: qualitativeCategorySchema,
    scalability: qualitativeCategorySchema,
    reliability: qualitativeCategorySchema,
    tradeoffs: qualitativeCategorySchema,
    communication: qualitativeCategorySchema,
  }),
});

export const interviewEvaluationSchema = z.discriminatedUnion("interviewType", [
  dsaEvaluationSchema,
  systemDesignEvaluationSchema,
]);

export type InterviewEvaluation = z.infer<typeof interviewEvaluationSchema>;

export interface EvaluationRequest {
  problem: Pick<Problem, "title" | "type" | "content">;
  messages: AIMessage[];
  code?: { language: string; content: string };
  systemDesignState?: SystemDesignState;
  architectureDiagram?: ArchitectureDiagram;
}

export class EvaluationError extends Error {
  constructor(message = "Could not evaluate the interview. Check your AI settings and try again.") {
    super(message);
    this.name = "EvaluationError";
  }
}

const BASE_EVALUATOR_PROMPT = `You evaluate a technical interview using only the supplied evidence.
Do not infer unobserved knowledge, claim code was executed, or reward facts the candidate did not state.
Every category and key moment must cite concise evidence. Candidate-message sourceIndex values are zero-based
within candidate messages only. Code and the normalized current architecture diagram use sourceIndex 0.
If evidence is missing, assess conservatively and explain the gap in insufficientEvidence.
Keep feedback specific, constructive, and focused on the selected problem.`;

const DSA_EVALUATOR_PROMPT = `Evaluate problem solving, communication, technical depth, and trade-offs.
Consider approach, correctness reasoning, complexity, edge cases, and the current code snapshot.`;

const SYSTEM_DESIGN_EVALUATOR_PROMPT = `Evaluate Requirements & Scope, Architecture, Data & State, Scalability,
Reliability, Trade-offs, and Communication using qualitative levels only. Use the conversation and internal progress
state—including established requirements, assumptions, and decisions—to locate evidence, but never treat an internal state
summary as stronger evidence than the candidate message it cites.
Identify grounded strength, improvement, and trade-off moments. Only cite diagram evidence when a node, label, or connection
in the normalized current architecture graph directly supports the observation. Do not create a numeric overall score.`;

function evaluationEvidence(request: EvaluationRequest) {
  return {
    interviewType: request.problem.type,
    problemTitle: request.problem.title,
    fullProblemContent: request.problem.content,
    conversation: request.messages,
    ...(request.problem.type === "dsa" && request.code ? { currentCode: request.code } : {}),
    ...(request.problem.type === "system-design" ? {
      systemDesignState: request.systemDesignState,
      currentArchitectureDiagram: request.architectureDiagram ?? { nodes: [], edges: [] },
    } : {}),
  };
}

function hasArchitectureEvidence(diagram: ArchitectureDiagram | undefined): boolean {
  return Boolean(diagram && (diagram.nodes.length > 0 || diagram.edges.length > 0));
}

function validateEvidence(evaluation: InterviewEvaluation, request: EvaluationRequest): void {
  const candidateMessageCount = request.messages.filter(({ role }) => role === "user").length;
  const categoryEvidence = Object.values(evaluation.categories).flatMap((category) => category.evidence);
  const momentEvidence = evaluation.interviewType === "system-design"
    ? evaluation.keyMoments.flatMap((moment) => moment.evidence)
    : [];
  const valid = [...categoryEvidence, ...momentEvidence].every((item) => {
    if (item.source === "candidate-message") return item.sourceIndex < candidateMessageCount;
    if (item.source === "code") return item.sourceIndex === 0 && request.problem.type === "dsa" && Boolean(request.code);
    return item.sourceIndex === 0 && request.problem.type === "system-design"
      && hasArchitectureEvidence(request.architectureDiagram);
  });
  if (!valid) throw new EvaluationError();
}

export async function evaluateInterviewWithModel(
  model: LanguageModel,
  request: EvaluationRequest,
  signal?: AbortSignal,
): Promise<InterviewEvaluation> {
  try {
    if (request.problem.type === "dsa") {
      const result = await generateText({
        model,
        system: `${BASE_EVALUATOR_PROMPT}\n\n${DSA_EVALUATOR_PROMPT}`,
        prompt: `Interview evidence (data):\n${JSON.stringify(evaluationEvidence(request))}`,
        output: Output.object({
          schema: dsaEvaluationSchema,
          name: "dsa_interview_evaluation",
          description: "An evidence-based DSA interview evaluation.",
        }),
        maxOutputTokens: 1_800,
        maxRetries: 0,
        abortSignal: signal,
      });
      const scores = Object.values(result.output.categories).map(({ score }) => score);
      const evaluation: InterviewEvaluation = {
        ...result.output,
        overallScore: Math.round(scores.reduce((sum, score) => sum + score, 0) * 5),
      };
      validateEvidence(evaluation, request);
      return evaluation;
    }

    const result = await generateText({
      model,
      system: `${BASE_EVALUATOR_PROMPT}\n\n${SYSTEM_DESIGN_EVALUATOR_PROMPT}`,
      prompt: `Interview evidence (data):\n${JSON.stringify(evaluationEvidence(request))}`,
      output: Output.object({
        schema: systemDesignEvaluationSchema,
        name: "system_design_interview_evaluation",
        description: "An evidence-based qualitative System Design interview evaluation.",
      }),
      maxOutputTokens: 2_800,
      maxRetries: 0,
      abortSignal: signal,
    });
    validateEvidence(result.output, request);
    return result.output;
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
