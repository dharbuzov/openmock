import { ownValue, safeError } from "../logging/sanitize";

export function interviewErrorMessage(error: unknown): string {
  const fallback =
    "Couldn’t get a response from the AI provider. Check your AI settings and try again.";
  if (
    ownValue(error, "name") === "AIProviderError" &&
    typeof ownValue(error, "message") === "string"
  )
    return String(ownValue(error, "message"));
  const chain: unknown[] = [];
  for (
    let current = error;
    current && chain.length < 5 && !chain.includes(current);
    current = ownValue(current, "cause")
  )
    chain.push(current);
  for (const item of chain) {
    const status = ownValue(item, "statusCode") ?? ownValue(item, "status");
    if (status === 401 || status === 403)
      return "AI provider authentication failed. Check your API key and model access in AI settings.";
    if (status === 429)
      return "The AI provider rate limit or quota was reached. Check your quota or try again shortly.";
    if (status === 404)
      return "The AI model or endpoint could not be found. Check your model and provider URL in AI settings.";
    if (
      /JSONParseError|TypeValidationError|NoObjectGeneratedError/.test(
        String(ownValue(item, "name")),
      )
    )
      return "The AI provider returned an empty or invalid interview response. Retry or select another model in AI settings.";
  }
  const reason = safeError(chain.at(-1) ?? error, {
    includeStack: false,
  }).message;
  if (typeof reason !== "string" || reason === "Unknown error") return fallback;
  if (/failed to fetch|fetch failed|network error|ECONNREFUSED/i.test(reason))
    return "Could not connect to the AI provider. Check your connection and provider URL; for a local provider, make sure it is running and allows browser requests.";
  // Keep the explanation without embedded payloads or stack traces.
  const explanation = reason
    .split(/\n|\{|(?:request|response)\s*(?:body|payload)|headers?\s*:/i)[0]
    .trim()
    .slice(0, 600);
  return explanation ? `AI provider request failed: ${explanation}` : fallback;
}
