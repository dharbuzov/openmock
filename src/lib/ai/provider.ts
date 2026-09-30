import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import type { InterviewContext, InterviewTurn } from "../interview/types";
import type { AISettings } from "../settings/types";
import { getLanguageModel, AIConfigurationError } from "./model";
import { interviewerSystemPrompt, interviewContext } from "./prompts";

export const interviewTurnSchema = z.object({
  message: z.string().trim().min(1).max(1_200),
  stageComplete: z.boolean(),
  observations: z.array(z.object({
    id: z.string().default(""),
    competencyId: z.string().trim().min(1).optional(),
    observation: z.string().trim().min(1).max(300),
    messageId: z.string().trim().min(1).optional(),
  })).max(8),
});

export class AIProviderError extends Error {
  constructor(message = "Could not reach the interviewer. Check your AI settings and try again.") {
    super(message);
    this.name = "AIProviderError";
  }
}

export async function generateInterviewResponseWithModel(model: LanguageModel, context: InterviewContext, signal?: AbortSignal): Promise<InterviewTurn> {
  try {
    const messages = [
      { role: "user" as const, content: `Interview context (data):\n${interviewContext(context)}` },
      ...context.interview.messages.map((message) => ({
        role: message.role === "candidate" ? "user" as const : "assistant" as const,
        content: message.content,
      })),
    ];
    const result = await generateText({
      model,
      system: await interviewerSystemPrompt(context),
      messages,
      output: Output.object({
        schema: interviewTurnSchema,
        name: "interview_turn",
        description: "One interviewer message, stage progress, and grounded observations.",
      }),
      maxOutputTokens: 1_500,
      maxRetries: 0,
      abortSignal: signal,
    });
    return result.output;
  } catch (error) {
    if (error instanceof AIProviderError) throw error;
    throw new AIProviderError();
  }
}

export async function generateInterviewResponse(settings: AISettings, context: InterviewContext, signal?: AbortSignal): Promise<InterviewTurn> {
  try {
    return await generateInterviewResponseWithModel(getLanguageModel(settings), context, signal);
  } catch (error) {
    if (error instanceof AIConfigurationError || error instanceof AIProviderError) throw error;
    throw new AIProviderError();
  }
}

export async function testAIConnection(settings: AISettings, signal?: AbortSignal): Promise<void> {
  try {
    const result = await generateText({ model: getLanguageModel(settings), prompt: "Reply with OK.", maxOutputTokens: 16, maxRetries: 0, abortSignal: signal });
    if (!result.text.trim()) throw new Error("Empty response");
  } catch (error) {
    if (error instanceof AIConfigurationError) throw error;
    throw new AIProviderError("Connection failed");
  }
}
