import { z } from "zod";
import {
  ownValue,
  safeError,
  sanitizeString,
  sanitizeValidationIssues,
} from "../logging/sanitize";

const messages = {
  PROVIDER_UNREACHABLE: "Could not connect to the AI provider.",
  AUTHENTICATION_FAILED:
    "Authentication with the AI provider failed. Check your API key.",
  RATE_LIMITED:
    "The AI provider rate limit was reached. Please try again shortly.",
  MODEL_NOT_FOUND: "The configured AI model could not be found.",
  REQUEST_TIMEOUT: "The AI provider did not respond in time.",
  STRUCTURED_OUTPUT_INVALID:
    "The AI provider returned an invalid evaluation response.",
  EMPTY_RESPONSE: "The AI provider returned an empty response.",
  EVALUATION_FAILED: "We couldn't generate your interview results.",
  UNKNOWN: "Something went wrong while evaluating your interview.",
} as const;

export const evaluationFailureSchema = z.object({
  name: z.literal("EvaluationError"),
  code: z.enum(
    Object.keys(messages) as [
      keyof typeof messages,
      ...(keyof typeof messages)[],
    ],
  ),
  message: z.string(),
  error: z.string().optional(),
  details: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  requestId: z.string().optional(),
});
export type EvaluationFailure = z.infer<typeof evaluationFailureSchema>;

// Extract diagnostics only; never serialize SDK payloads, headers, or response bodies.
export function evaluationFailure(
  error: unknown,
  metadata: { provider?: string; model?: string; requestId?: string } = {},
): EvaluationFailure {
  const attached = ownValue(error, "failure");
  const parsed = evaluationFailureSchema.safeParse(attached);
  if (parsed.success) return parsed.data;
  const chain: unknown[] = [];
  for (
    let current = error;
    current && chain.length < 5 && !chain.includes(current);
    current = ownValue(current, "cause")
  )
    chain.push(current);
  const names = chain
    .map((item) => String(ownValue(item, "name") ?? ""))
    .join(" ");
  const text = chain
    .map((item) => String(ownValue(item, "message") ?? ""))
    .join(" ");
  const statuses = chain.map(
    (item) => ownValue(item, "statusCode") ?? ownValue(item, "status"),
  );
  const codes = chain.map((item) => ownValue(item, "code")).join(" ");
  let code: keyof typeof messages = "UNKNOWN";
  if (
    statuses.includes(401) ||
    statuses.includes(403) ||
    /invalid.api.key|authentication|api key before/i.test(text)
  )
    code = "AUTHENTICATION_FAILED";
  else if (statuses.includes(429)) code = "RATE_LIMITED";
  else if (
    statuses.includes(404) ||
    /model.*(?:not found|does not exist)|select an ai model/i.test(text)
  )
    code = "MODEL_NOT_FOUND";
  else if (
    /TimeoutError|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT/.test(names + codes) ||
    /timed? out|timeout/i.test(text)
  )
    code = "REQUEST_TIMEOUT";
  else if (
    chain.some(
      (item) =>
        ownValue(item, "text") === "" &&
        /NoObjectGeneratedError/.test(String(ownValue(item, "name"))),
    ) ||
    /empty response|no (?:content|text|response)|no object generated.*no response/i.test(
      text,
    )
  )
    code = "EMPTY_RESPONSE";
  else if (
    /JSONParseError|TypeValidationError|ZodError|NoObjectGeneratedError/.test(
      names,
    )
  )
    code = "STRUCTURED_OUTPUT_INVALID";
  else if (
    /ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ECONNRESET/.test(codes) ||
    /failed to fetch|fetch failed|network error|connect/i.test(text)
  )
    code = "PROVIDER_UNREACHABLE";
  else if (names.includes("EvaluationError")) code = "EVALUATION_FAILED";
  const issues = chain.flatMap((item) =>
    sanitizeValidationIssues(ownValue(item, "issues")),
  );
  const details = issues
    .map(
      ({ path, message }) =>
        `${path.reduce<string>((value, part) => (typeof part === "number" ? `${value}[${part}]` : `${value}${value ? "." : ""}${part}`), "")}: ${message}`,
    )
    .join("\n");
  const underlying = chain.at(-1);
  const safe = safeError(underlying, { includeStack: false });
  // Free-form exceptions can embed payloads. Keep their explanation, omit embedded blocks.
  const explanation =
    typeof safe.message === "string"
      ? safe.message
          .split(
            /\n|\{|\[|(?:request|response)\s*(?:body|payload)|headers?\s*:/i,
          )[0]
          .trim()
          .slice(0, 600)
      : undefined;
  const clean = (value: string | undefined) =>
    value ? sanitizeString(value).slice(0, 2000) : undefined;
  return {
    name: "EvaluationError",
    code,
    message: messages[code],
    error:
      code === "STRUCTURED_OUTPUT_INVALID"
        ? "Structured output validation failed"
        : clean(explanation),
    details: clean(details),
    provider: clean(metadata.provider),
    model: clean(metadata.model),
    requestId: clean(
      metadata.requestId ??
        chain
          .map((item) => ownValue(item, "requestId"))
          .find((id): id is string => typeof id === "string"),
    ),
  };
}
