import { generateText, wrapLanguageModel } from "ai";
import { logger } from "../logging/logger";
import { ownValue } from "../logging/sanitize";

// Shared boundary for interviewer turns, evaluations and connection tests.
export function loggedGenerateText(
  metadata: Record<string, unknown>,
): typeof generateText {
  return async (options) => {
    const requestId = crypto.randomUUID();
    const started = performance.now();
    const { model, abortSignal, output, ...payload } = options;
    void abortSignal;
    void output;
    const context = { ...metadata, requestId };
    let request: unknown = payload;
    let response: unknown;
    const durationMs = () => Math.round(performance.now() - started);
    const wrapped =
      typeof model !== "string" && model.specificationVersion === "v3"
        ? wrapLanguageModel({
            model,
            middleware: {
              specificationVersion: "v3",
              wrapGenerate: async ({ doGenerate, params }) => {
                const { abortSignal, ...providerRequest } = params;
                void abortSignal;
                request = { ...payload, providerRequest };
                logger.debug({ ...context, request }, "AI request");
                const result = await doGenerate();
                // Log the provider result before SDK JSON parsing/schema validation.
                response = result;
                logger.debug(
                  { ...context, durationMs: durationMs(), response },
                  "AI response",
                );
                return result;
              },
            },
          })
        : model;
    if (wrapped === model) logger.debug({ ...context, request }, "AI request");
    try {
      const result = await generateText({ ...options, model: wrapped });
      if (wrapped === model) {
        response = {
          text: result.text,
          usage: result.usage,
          finishReason: result.finishReason,
          request: result.request,
          response: result.response,
          toolCalls: result.toolCalls,
          toolResults: result.toolResults,
        };
        logger.debug(
          { ...context, durationMs: durationMs(), response },
          "AI response",
        );
      }
      return result;
    } catch (error) {
      logger.error(
        {
          ...context,
          durationMs: durationMs(),
          err: error,
          ...(logger.isLevelEnabled("debug")
            ? {
                request,
                response: response ?? {
                  text: ownValue(error, "text"),
                  body: ownValue(error, "responseBody"),
                },
              }
            : {}),
        },
        "AI request failed",
      );
      throw error;
    }
  };
}
