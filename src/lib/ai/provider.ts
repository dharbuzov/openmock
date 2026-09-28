import { generateText, Output, type LanguageModel } from "ai";
import type { AISettings } from "../settings/types";
import type { Problem } from "../problems/types";
import type { ArchitectureDiagram } from "../diagram/types";
import {
  createInitialSystemDesignState,
  mergeSystemDesignState,
  systemDesignTurnSchema,
  type SystemDesignState,
} from "../interview/system-design";
import { getLanguageModel, AIConfigurationError } from "./model";
import { interviewerSystemPrompt, interviewContext } from "./prompts";

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIRequest {
  problem: Pick<Problem, "title" | "type" | "content">;
  messages: AIMessage[];
  code?: { language: string; content: string };
  systemDesignState?: SystemDesignState;
  architectureDiagram?: ArchitectureDiagram;
}

export interface InterviewTurnResult {
  content: string;
  systemDesignState?: SystemDesignState;
}

export class AIProviderError extends Error {
  constructor(message = "Could not reach the interviewer. Check your AI settings and try again.") {
    super(message);
    this.name = "AIProviderError";
  }
}

export async function generateInterviewResponseWithModel(
  model: LanguageModel,
  request: AIRequest,
  signal?: AbortSignal,
): Promise<InterviewTurnResult> {
  try {
    const messages = [
      { role: "user" as const, content: `Interview context (data):\n${interviewContext(request)}` },
      ...request.messages,
    ];

    if (request.problem.type === "system-design") {
      const previousState = request.systemDesignState ?? createInitialSystemDesignState();
      const result = await generateText({
        model,
        system: interviewerSystemPrompt(request.problem.type),
        messages,
        output: Output.object({
          schema: systemDesignTurnSchema,
          name: "system_design_interview_turn",
          description: "One concise interviewer response and updated internal System Design progress.",
        }),
        maxOutputTokens: 1_200,
        maxRetries: 0,
        abortSignal: signal,
      });
      const candidateMessageCount = request.messages.filter(({ role }) => role === "user").length;
      return {
        content: result.output.response,
        systemDesignState: mergeSystemDesignState(previousState, result.output.state, candidateMessageCount),
      };
    }

    const result = await generateText({
      model,
      system: interviewerSystemPrompt(request.problem.type),
      messages,
      maxOutputTokens: 900,
      maxRetries: 0,
      abortSignal: signal,
    });
    if (!result.text.trim()) throw new AIProviderError();
    return { content: result.text };
  } catch (error) {
    if (error instanceof AIProviderError) throw error;
    throw new AIProviderError();
  }
}

export async function generateInterviewResponse(
  settings: AISettings,
  request: AIRequest,
  signal?: AbortSignal,
): Promise<InterviewTurnResult> {
  try {
    return await generateInterviewResponseWithModel(getLanguageModel(settings), request, signal);
  } catch (error) {
    if (error instanceof AIConfigurationError || error instanceof AIProviderError) throw error;
    throw new AIProviderError();
  }
}

export async function testAIConnection(settings: AISettings, signal?: AbortSignal): Promise<void> {
  try {
    const result = await generateText({
      model: getLanguageModel(settings),
      prompt: "Reply with OK.",
      maxOutputTokens: 16,
      maxRetries: 0,
      abortSignal: signal,
    });
    if (!result.text.trim()) throw new Error("Empty response");
  } catch (error) {
    if (error instanceof AIConfigurationError) throw error;
    throw new AIProviderError("Connection failed");
  }
}
