import {
  loggedGenerateText,
  loggedLanguageModel,
  loggedOutput,
} from "./logging";
import { createTurnContext, type TurnContext } from "../logging/turn";
import { protectCredentials } from "../logging/sanitize";
import { logger } from "../logging/logger";
import { Output, streamText, type LanguageModel } from "ai";
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
  onMessage?: (message: string) => void,
  turnContext?: TurnContext,
): Promise<InterviewTurn> {
  const started = performance.now();
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
    component: "llm",
    turnId:
      turnContext?.turnId ??
      context.interview.messages.at(-1)?.id ??
      crypto.randomUUID(),
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
    const options = {
      model,
      system: await interviewerSystemPrompt(context, metadata),
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
    };
    if (
      onMessage &&
      (typeof model === "string" || typeof model.doStream === "function")
    ) {
      const requestId = crypto.randomUUID();
      const started = performance.now();
      const logContext = { ...metadata, requestId };
      logger.debug(logContext, "LLM_STARTED");
      const result = streamText({
        ...options,
        model: loggedLanguageModel(
          model,
          {
            system: options.system,
            messages,
            maxOutputTokens: options.maxOutputTokens,
            maxRetries: options.maxRetries,
          },
          logContext,
        ),
        output: loggedOutput(options.output, logContext),
        onError: ({ error }) =>
          logger.error({ ...logContext, err: error }, "AI request failed"),
        onFinish: ({ text, usage, finishReason }) =>
          logger.debug(
            {
              ...logContext,
              durationMs: Math.round(performance.now() - started),
              responseLength: text.length,
              usage,
              finishReason,
            },
            "AI response",
          ),
      });
      for await (const partial of result.partialOutputStream) {
        // Partial text is UI-only. Stages and observations still require the final validated turn.
        if (
          !signal?.aborted &&
          typeof partial.message === "string" &&
          partial.message.length > 0
        )
          onMessage(partial.message);
      }
      return await result.output;
    }
    const result = await loggedGenerateText(metadata)(options);
    return result.output;
  } catch (error) {
    logger.error(
      {
        ...metadata,
        err: error,
        durationMs: Math.round(performance.now() - started),
      },
      "Interviewer generation failed",
    );
    if (error instanceof AIProviderError) throw error;
    throw new AIProviderError();
  }
}

export async function generateInterviewResponse(
  settings: AISettings,
  context: InterviewContext,
  signal?: AbortSignal,
  onMessage?: (message: string) => void,
  turnContext?: TurnContext,
): Promise<InterviewTurn> {
  turnContext ??= createTurnContext(context.interview.id);
  const started = performance.now();
  const releaseCredentials = protectCredentials(
    "apiKey" in settings ? [settings.apiKey] : [],
  );
  try {
    return await generateInterviewResponseWithModel(
      getLanguageModel(settings, {
        interviewId: context.interview.id,
        turnId: turnContext?.turnId ?? context.interview.messages.at(-1)?.id,
        operation: "interviewer-turn",
      }),
      context,
      signal,
      onMessage,
      turnContext,
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
          turnId: turnContext?.turnId,
          component: "llm",
          endpoint: "baseUrl" in settings ? settings.baseUrl : undefined,
          durationMs: Math.round(performance.now() - started),
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
  const started = performance.now();
  const releaseCredentials = protectCredentials(
    "apiKey" in settings ? [settings.apiKey] : [],
  );
  const metadata = {
    provider: settings.provider,
    model: settings.model,
    operation: "connection-test",
    retry: 0,
    component: "llm",
    requestId: crypto.randomUUID(),
  };
  try {
    const result = await loggedGenerateText(metadata)({
      model: getLanguageModel(settings, metadata),
      prompt: "Reply with OK.",
      maxOutputTokens: 16,
      maxRetries: 0,
      abortSignal: signal,
    });
    if (!result.text.trim()) throw new Error("Empty response");
    logger.info(
      { ...metadata, durationMs: Math.round(performance.now() - started) },
      "AI connection tested",
    );
  } catch (error) {
    logger.error(
      {
        ...metadata,
        err: error,
        durationMs: Math.round(performance.now() - started),
      },
      "AI connection test failed",
    );
    if (error instanceof AIConfigurationError) throw error;
    throw new AIProviderError("Connection failed");
  } finally {
    releaseCredentials();
  }
}
