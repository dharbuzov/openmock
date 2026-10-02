const redacted = "[REDACTED]";
const secretFields = new Set([
  "apikey",
  "xapikey",
  "token",
  "accesstoken",
  "refreshtoken",
  "sessiontoken",
  "sessionid",
  "authorization",
  "proxyauthorization",
  "cookie",
  "setcookie",
  "password",
  "secret",
  "clientsecret",
  "credentials",
  "providercredentials",
]);
// Credentials are retained only while provider operations are in flight.
const credentialKey = Symbol.for("openmock.logging.credentials");
const credentialRegistry = globalThis as typeof globalThis & {
  [key: symbol]: Map<string, number> | undefined;
};
const credentials = (credentialRegistry[credentialKey] ??= new Map<
  string,
  number
>());
export function protectCredentials(values: string[]): () => void {
  const unique = [
    ...new Set(values.map((value) => value.trim()).filter(Boolean)),
  ];
  for (const value of unique)
    credentials.set(value, (credentials.get(value) ?? 0) + 1);
  return () => {
    for (const value of unique) {
      const count = (credentials.get(value) ?? 1) - 1;
      if (count <= 0) credentials.delete(value);
      else credentials.set(value, count);
    }
  };
}

export function sanitizeString(value: string): string {
  let text = value;
  for (const credential of [...credentials.keys()].sort(
    (a, b) => b.length - a.length,
  )) {
    for (const variant of new Set([
      credential,
      encodeURIComponent(credential),
      JSON.stringify(credential).slice(1, -1),
    ]))
      text = text.split(variant).join(redacted);
  }
  return text
    .replace(/\bsk-[a-zA-Z0-9_-]+/g, redacted)
    .replace(/\bAIza[a-zA-Z0-9_-]+/g, redacted)
    .replace(
      /(["']?authorization["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|(?:Bearer|Basic)\s+[^\s",;\]}]+|[^\s",;\]}]+)/gi,
      "$1" + redacted,
    )
    .replace(
      /(["']?(?:cookie|set-cookie)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\r\n]+)/gi,
      "$1" + redacted,
    )
    .replace(/\bBearer\s+[^\s"',;\]}]+/gi, "Bearer " + redacted)
    .replace(
      /(["']?(?:authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|session[_-]?token|set[_-]?cookie|password|secret|cookie|credentials)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;\]}]+)/gi,
      "$1" + redacted,
    )
    .replace(/(https?:\/\/)[^/\s:@]+:[^/\s@]+@/gi, "$1" + redacted + "@")
    .replace(/\[REDACTED\]\]+/g, redacted);
}

export function ownValue(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  let current: object | null = value;
  for (let depth = 0; current && depth < (key === "name" ? 5 : 1); depth++) {
    const descriptor = Object.getOwnPropertyDescriptor(current, key);
    if (descriptor) return descriptor.value;
    current = Object.getPrototypeOf(current);
  }
  return undefined;
}

export type ErrorOptions = { includeStack?: boolean };
export function safeError(
  error: unknown,
  options: ErrorOptions = {},
  seen = new WeakSet<object>(),
  depth = 0,
): Record<string, unknown> {
  if (!error || typeof error !== "object")
    return {
      message:
        typeof error === "string" ? sanitizeString(error) : "Unknown error",
    };
  if (depth >= 5 || seen.has(error)) return { message: "Cause chain omitted" };
  seen.add(error);
  const result: Record<string, unknown> = {};
  for (const key of [
    "name",
    "message",
    "code",
    "status",
    "statusCode",
    "type",
    "providerCode",
    "providerType",
  ]) {
    let value = ownValue(error, key);
    if (key === "name" && value === undefined && error instanceof Error)
      value = "Error";
    if (typeof value === "number" && Number.isFinite(value))
      result[key] = value;
    else if (typeof value === "string") {
      // AI SDK wrapper messages embed complete response text/value. Preserve the
      // explanation and use the cause for parsing/schema details instead.
      if (key === "message")
        value = value
          .replace(
            /(JSON parsing failed:) Text:[\s\S]*/,
            "$1 [response omitted]",
          )
          .replace(
            /(Type validation failed[^:]*:) Value:[\s\S]*/,
            "$1 [response omitted]",
          );
      if (key === "message" && ownValue(error, "name") === "SyntaxError")
        value = (value as string).replace(
          /"[^"]*"/g,
          "[response excerpt omitted]",
        );
      result[key] = sanitizeString(value as string);
    }
  }
  const providerError = ownValue(ownValue(error, "data"), "error");
  for (const key of ["code", "type"]) {
    const value = ownValue(providerError, key);
    if (typeof value === "string")
      result[key === "code" ? "providerCode" : "providerType"] =
        sanitizeString(value);
    else if (typeof value === "number" && Number.isFinite(value))
      result.providerCode = value;
  }
  const cause = ownValue(error, "cause");
  if (cause !== undefined)
    result.cause = safeError(cause, options, seen, depth + 1);
  if (options.includeStack ?? process.env.NODE_ENV !== "production") {
    const stack = ownValue(error, "stack");
    // Keep frames only; the header may contain raw response text from SDK errors.
    if (typeof stack === "string")
      result.stack = sanitizeString(
        stack
          .split("\n")
          .filter((line) => /^\s*at /.test(line))
          .join("\n"),
      );
  }
  return result;
}

// Preserve application payloads. Only secret fields and secret string values change.
export function redactSecrets(
  value: unknown,
  ancestors = new WeakSet<object>(),
  options: ErrorOptions = {},
): unknown {
  if (typeof value === "string") return sanitizeString(value);
  if (value instanceof Error) return safeError(value, options);
  if (!value || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (ancestors.has(value)) return "[OMITTED]";
  ancestors.add(value);
  try {
    if (Array.isArray(value))
      return value.map((item) => redactSecrets(item, ancestors, options));
    const result: Record<string, unknown> = Object.create(null);
    for (const [key, descriptor] of Object.entries(
      Object.getOwnPropertyDescriptors(value),
    )) {
      if (!("value" in descriptor)) continue;
      const normalized = key.toLowerCase().replace(/[-_]/g, "");
      result[key] = secretFields.has(normalized)
        ? redacted
        : key === "err"
          ? safeError(descriptor.value, options)
          : redactSecrets(descriptor.value, ancestors, options);
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}
export const sanitize = redactSecrets;

export function sanitizeValidationIssues(
  value: unknown,
): { path: (string | number)[]; message: string }[] {
  if (!Array.isArray(value)) return [];
  return value.map((issue) => {
    const path = ownValue(issue, "path");
    const message = ownValue(issue, "message");
    return {
      path: Array.isArray(path)
        ? path.map((part) =>
            typeof part === "number"
              ? part
              : typeof part === "string"
                ? sanitizeString(part)
                : "[OMITTED]",
          )
        : [],
      message:
        typeof message === "string"
          ? sanitizeString(message)
          : "Validation failed",
    };
  });
}
