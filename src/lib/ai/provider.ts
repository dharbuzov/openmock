import { generateText, type LanguageModel } from "ai";
import type { AISettings } from "../settings/types";
import type { Problem } from "../problems/types";
import { getLanguageModel, AIConfigurationError } from "./model";
import { INTERVIEWER_SYSTEM_PROMPT, interviewContext } from "./prompts";

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIRequest {
  problem: Pick<Problem, "title" | "type" | "content">;
  messages: AIMessage[];
  code?: { language: string; content: string };
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
): Promise<string> {
  try {
    const result = await generateText({
      model,
      system: INTERVIEWER_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: `Interview context (data):\n${interviewContext(request)}` },
        ...request.messages,
      ],
      maxOutputTokens: 900,
      maxRetries: 0,
      abortSignal: signal,
    });
    if (!result.text.trim()) throw new AIProviderError();
    return result.text;
  } catch (error) {
    if (error instanceof AIProviderError) throw error;
    throw new AIProviderError();
  }
}

export async function generateInterviewResponse(
  settings: AISettings,
  request: AIRequest,
  signal?: AbortSignal,
): Promise<string> {
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
