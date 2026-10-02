import { loggedGenerateText } from "./logging";
import { protectCredentials } from "../logging/sanitize";
import { logger } from "../logging/logger";
import { Output, type LanguageModel } from "ai";
import { z } from "zod";
import type { InterviewContext, InterviewTurn } from "../interview/types";
import type { AISettings } from "../settings/types";
import { getLanguageModel, AIConfigurationError } from "./model";
import { interviewerSystemPrompt, interviewContext } from "./prompts";

export const interviewTurnSchema = z.object({
  message: z.string().trim().min(1).max(1_200),
  stageComplete: z.boolean(),
  observations: z
    .array(
      z.object({
        id: z.string().default(""),
        competencyId: z.string().trim().min(1).optional(),
        observation: z.string().trim().min(1).max(300),
        messageId: z.string().trim().min(1).optional(),
      }),
    )
    .max(8),
});

export class AIProviderError extends Error {
  constructor(
    message = "Could not reach the interviewer. Check your AI settings and try again.",
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

export async function generateInterviewResponseWithModel(
  model: LanguageModel,
  context: InterviewContext,
  signal?: AbortSignal,
): Promise<InterviewTurn> {
  const metadata = {
    provider: typeof model === "string" ? "gateway" : model.provider,
    model: typeof model === "string" ? model : model.modelId,
    operation: "interviewer-turn",
    interviewId: context.interview.id,
    stageId: context.interview.stage.current,
    targetLevel: context.interview.targetLevel,
    problemId: context.problem.id,
    definitionId: context.definition.id,
    retry: 0,
  };

  try {
    const messages = [
      {
        role: "user" as const,
        content: `Interview context (data):\n${interviewContext(context)}`,
      },
      ...context.interview.messages.map((message) => ({
        role:
          message.role === "candidate"
            ? ("user" as const)
            : ("assistant" as const),
        content: message.content,
      })),
    ];
    const result = await loggedGenerateText({
      ...metadata,
      ...(logger.isLevelEnabled("debug")
        ? { workspace: context.workspace }
        : {}),
    })({
      model,
      system: await interviewerSystemPrompt(context),
      messages,
      output: Output.object({
        schema: interviewTurnSchema,
        name: "interview_turn",
        description:
          "One interviewer message, stage progress, and grounded observations.",
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

export async function generateInterviewResponse(
  settings: AISettings,
  context: InterviewContext,
  signal?: AbortSignal,
): Promise<InterviewTurn> {
  const releaseCredentials = protectCredentials(
    "apiKey" in settings ? [settings.apiKey] : [],
  );
  try {
    return await generateInterviewResponseWithModel(
      getLanguageModel(settings),
      context,
      signal,
    );
  } catch (error) {
    if (!(error instanceof AIProviderError))
      logger.error(
        {
          provider: settings.provider,
          model: settings.model,
          operation: "interviewer-turn",
          interviewId: context.interview.id,
          stageId: context.interview.stage.current,
          err: error,
        },
        "AI configuration failed",
      );
    if (
      error instanceof AIConfigurationError ||
      error instanceof AIProviderError
    )
      throw error;
    throw new AIProviderError();
  } finally {
    releaseCredentials();
  }
}

export async function testAIConnection(
  settings: AISettings,
  signal?: AbortSignal,
): Promise<void> {
  const releaseCredentials = protectCredentials(
    "apiKey" in settings ? [settings.apiKey] : [],
  );
  const metadata = {
    provider: settings.provider,
    model: settings.model,
    operation: "connection-test",
    retry: 0,
  };
  try {
    const result = await loggedGenerateText(metadata)({
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
  } finally {
    releaseCredentials();
  }
}
