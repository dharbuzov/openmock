import {
  generateText,
  wrapLanguageModel,
  type LanguageModel,
  type Output,
} from "ai";
import { logger } from "../logging/logger";
import { ownValue, protectCredentials } from "../logging/sanitize";

// Observe SDK parsing without replacing its parser, schema, or partial-output behavior.
export function loggedOutput<O extends Output.Output>(
  output: O,
  context: Record<string, unknown>,
): O {
  return {
    ...output,
    async parseCompleteOutput(input, metadata) {
      const started = performance.now();
      try {
        const parsed = await output.parseCompleteOutput(input, metadata);
        if (logger.isLevelEnabled("trace"))
          logger.trace({ ...context, parsed, metadata }, "LLM_PARSED_RESPONSE");
        logger.debug(
          {
            ...context,
            durationMs: Math.round(performance.now() - started),
            success: true,
          },
          "PARSE_COMPLETED",
        );
        return parsed;
      } catch (error) {
        if (logger.isLevelEnabled("trace"))
          logger.trace(
            {
              ...context,
              text: input.text,
              err: error,
              cause: ownValue(error, "cause"),
            },
            "LLM_PARSE_ERROR",
          );
        logger.error(
          {
            ...context,
            component: "structured-output",
            operation: "parse",
            durationMs: Math.round(performance.now() - started),
            err: error,
          },
          "PARSE_FAILED",
        );
        throw error;
      }
    },
  };
}

export function loggedLanguageModel(
  model: LanguageModel,
  payload: Record<string, unknown>,
  context: Record<string, unknown>,
): LanguageModel {
  if (typeof model === "string" || model.specificationVersion !== "v3") {
    if (logger.isLevelEnabled("trace"))
      logger.trace({ ...context, request: payload }, "LLM_REQUEST");
    return model;
  }
  return wrapLanguageModel({
    model,
    middleware: {
      specificationVersion: "v3",
      wrapGenerate: async ({ doGenerate, params }) => {
        const { abortSignal, ...providerRequest } = params;
        void abortSignal;
        if (logger.isLevelEnabled("trace"))
          logger.trace(
            { ...context, request: { ...payload, providerRequest } },
            "LLM_REQUEST",
          );
        const started = performance.now();
        const result = await doGenerate();
        if (logger.isLevelEnabled("trace"))
          logger.trace(
            {
              ...context,
              durationMs: Math.round(performance.now() - started),
              response: result,
            },
            "LLM_RAW_RESPONSE",
          );
        logger.debug(
          {
            ...context,
            durationMs: Math.round(performance.now() - started),
            usage: result.usage,
            finishReason: result.finishReason,
          },
          "LLM_COMPLETED",
        );
        return result;
      },
      wrapStream: async ({ doStream, params }) => {
        const { abortSignal, ...providerRequest } = params;
        void abortSignal;
        if (logger.isLevelEnabled("trace"))
          logger.trace(
            { ...context, request: { ...payload, providerRequest } },
            "LLM_REQUEST",
          );
        const started = performance.now();
        const result = await doStream();
        const chunks: unknown[] | undefined = logger.isLevelEnabled("trace")
          ? []
          : undefined;
        const { stream, ...metadata } = result;
        return {
          ...result,
          stream: stream.pipeThrough(
            new TransformStream({
              transform(chunk, controller) {
                chunks?.push(chunk);
                if (chunk.type === "error")
                  logger.error(
                    {
                      ...context,
                      component: "llm",
                      err: chunk.error,
                      durationMs: Math.round(performance.now() - started),
                    },
                    "LLM_STREAM_FAILED",
                  );
                if (chunk.type === "finish")
                  logger.debug(
                    {
                      ...context,
                      durationMs: Math.round(performance.now() - started),
                      usage: chunk.usage,
                      finishReason: chunk.finishReason,
                    },
                    "LLM_COMPLETED",
                  );
                controller.enqueue(chunk);
              },
              flush() {
                if (chunks)
                  logger.trace(
                    { ...context, response: { ...metadata, chunks } },
                    "LLM_RAW_RESPONSE",
                  );
              },
            }),
          ),
        };
      },
    },
  });
}

// Shared boundary for interviewer turns, evaluations and connection tests.
export function loggedGenerateText(
  metadata: Record<string, unknown>,
): typeof generateText {
  return async (options) => {
    const started = performance.now();
    const { model, abortSignal, output, ...payload } = options;
    void abortSignal;
    const context = {
      component: "llm",
      ...metadata,
      requestId: crypto.randomUUID(),
    };
    logger.debug(
      {
        ...context,
        messageCount: options.messages?.length,
        maxOutputTokens: options.maxOutputTokens,
      },
      "LLM_STARTED",
    );
    const wrapped = loggedLanguageModel(model, payload, context);
    try {
      const result = await generateText({
        ...options,
        model: wrapped,
        ...(output ? { output: loggedOutput(output, context) } : {}),
      });
      if (wrapped === model && logger.isLevelEnabled("trace"))
        logger.trace(
          {
            ...context,
            response: {
              text: result.text,
              usage: result.usage,
              finishReason: result.finishReason,
              request: result.request,
              response: result.response,
              toolCalls: result.toolCalls,
              toolResults: result.toolResults,
            },
          },
          "LLM_RAW_RESPONSE",
        );
      logger.debug(
        {
          ...context,
          durationMs: Math.round(performance.now() - started),
          usage: result.usage,
          responseLength: result.text.length,
        },
        "LLM_REQUEST_COMPLETED",
      );
      return result;
    } catch (error) {
      if (logger.isLevelEnabled("trace"))
        logger.trace(
          {
            ...context,
            text: ownValue(error, "text"),
            body: ownValue(error, "responseBody"),
          },
          "LLM_ERROR_RESPONSE",
        );
      logger.error(
        {
          ...context,
          durationMs: Math.round(performance.now() - started),
          err: error,
        },
        "AI request failed",
      );
      throw error;
    }
  };
}

// SDK custom fetch observes the actual wire body (including SSE) without consuming
// the provider's response or changing its request. No headers are ever logged.
export function loggedProviderFetch(
  metadata: Record<string, unknown>,
  credentials: string[],
): typeof fetch {
  return async (input, init) => {
    const started = performance.now();
    const context = {
      ...metadata,
      component: "llm-http",
      requestId: crypto.randomUUID(),
      endpoint:
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      method: init?.method ?? (input instanceof Request ? input.method : "GET"),
    };
    const release = protectCredentials(credentials);
    let observing = false;
    try {
      if (logger.isLevelEnabled("trace") && typeof init?.body === "string")
        logger.trace({ ...context, body: init.body }, "HTTP_REQUEST_BODY");
      const response = await fetch(input, init);
      if (logger.isLevelEnabled("debug"))
        logger.debug(
          {
            ...context,
            status: response.status,
            durationMs: Math.round(performance.now() - started),
            requestBytes:
              typeof init?.body === "string"
                ? new TextEncoder().encode(init.body).byteLength
                : undefined,
            responseBytes: response.headers.get("content-length"),
          },
          "HTTP_RESPONSE",
        );
      if (logger.isLevelEnabled("trace")) {
        try {
          const copy = response.clone();
          const contentType = copy.headers.get("content-type") ?? "";
          if (/json|text|event-stream/.test(contentType)) {
            observing = true;
            void copy
              .text()
              .then((body) =>
                logger.trace(
                  {
                    ...context,
                    status: copy.status,
                    contentType,
                    body,
                    responseBytes: new TextEncoder().encode(body).byteLength,
                    durationMs: Math.round(performance.now() - started),
                  },
                  "HTTP_RESPONSE_BODY",
                ),
              )
              .catch((error) =>
                logger.debug(
                  { ...context, err: error },
                  "HTTP observation ended",
                ),
              )
              .finally(release);
          }
        } catch {
          /* An uncloneable response must still reach the SDK. */
        }
      }
      return response;
    } catch (error) {
      logger.error(
        {
          ...context,
          err: error,
          durationMs: Math.round(performance.now() - started),
        },
        "HTTP_FAILED",
      );
      throw error;
    } finally {
      if (!observing) release();
    }
  };
}
