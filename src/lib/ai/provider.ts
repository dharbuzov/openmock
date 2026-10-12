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
import {
  interviewerSystemPrompt,
  interviewerInput,
  interviewerContextBudget,
} from "./prompts";
import { interviewErrorMessage } from "./error";

export const interviewTurnSchema = z.object({
  stageId: z.string().trim().min(1),
  message: z.string().trim().min(1).max(1_200),
  stageComplete: z
    .boolean()
    .describe(
      "True when the active stage objective is sufficiently explored through candidate answers or workspace evidence. Recommend completion instead of repeating answered follow-ups. The engine alone advances stages.",
    ),
  observations: z
    .array(
      z.object({
        id: z.string(),
        competencyId: z.string().trim().min(1).nullable(),
        observation: z.string().trim().min(1).max(300),
        messageId: z.string().trim().min(1).nullable(),
      }),
    )
    .max(8),
});

// Strict provider schemas require every key; null represents an absent reference.
function normalizeInterviewTurn(
  turn: z.infer<typeof interviewTurnSchema>,
): InterviewTurn {
  return {
    ...turn,
    observations: turn.observations.map(
      ({ competencyId, messageId, ...observation }) => ({
        ...observation,
        ...(competencyId === null ? {} : { competencyId }),
        ...(messageId === null ? {} : { messageId }),
      }),
    ),
  };
}

export class AIProviderError extends Error {
  constructor(
    message = "Could not reach the interviewer. Check your AI settings and try again.",
    options?: ErrorOptions,
  ) {
    super(message, options);
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
  let streamError: unknown;
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
    const currentStage = context.interview.stage.current;
    if (currentStage === null)
      throw new AIProviderError("No active interview stage.");
    const competencyIds = context.definition.evaluation.competencies.map(
      ({ id }) => id,
    );
    const system = await interviewerSystemPrompt(context, metadata);
    const schemaOverhead =
      JSON.stringify(z.toJSONSchema(interviewTurnSchema)).length +
      JSON.stringify(competencyIds).length +
      currentStage.length +
      512;
    const { messages, messageIds, diagnostics } = interviewerInput(
      context,
      system,
      interviewerContextBudget - schemaOverhead,
    );
    logger.debug({ ...metadata, ...diagnostics }, "INTERVIEW_CONTEXT");
    const options = {
      model,
      system,
      messages,
      output: Output.object({
        schema: interviewTurnSchema.extend({
          stageId: z.enum([currentStage]),
          observations: z
            .array(
              interviewTurnSchema.shape.observations.element.extend({
                competencyId: z.enum(competencyIds).nullable(),
                messageId: messageIds.length
                  ? z.enum(messageIds).nullable()
                  : z.null(),
              }),
            )
            .max(8),
        }),
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
        onError: ({ error }) => {
          streamError = error;
          logger.error({ ...logContext, err: error }, "AI request failed");
        },
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
        // Draft text is provisional. The runner holds it until stage validation
        // and the authoritative session commit have both succeeded.
        if (
          !signal?.aborted &&
          typeof partial.message === "string" &&
          partial.message.length > 0
        )
          onMessage(partial.message);
      }
      if (streamError !== undefined) throw streamError;
      return normalizeInterviewTurn(await result.output);
    }
    const result = await loggedGenerateText(metadata)(options);
    return normalizeInterviewTurn(result.output);
  } catch (error) {
    error = streamError ?? error;
    logger.error(
      {
        ...metadata,
        err: error,
        durationMs: Math.round(performance.now() - started),
      },
      "Interviewer generation failed",
    );
    if (error instanceof AIProviderError) throw error;
    throw new AIProviderError(interviewErrorMessage(error), { cause: error });
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
    throw new AIProviderError(interviewErrorMessage(error), { cause: error });
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
