import pino, { type Logger as PinoLogger } from "pino";
import { redactSecrets } from "./sanitize";
export { safeError } from "./sanitize";

export const levels = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
] as const;
export type LogLevel = (typeof levels)[number];
export function resolveLevel(
  value: string | undefined,
  production: boolean,
): LogLevel {
  if (value === undefined || value === "") return production ? "info" : "debug";
  return levels.includes(value as LogLevel) ? (value as LogLevel) : "info";
}
export type Logger = { isLevelEnabled: (level: LogLevel) => boolean } & Record<
  LogLevel,
  (context: Record<string, unknown>, event: string) => void
>;

export function wrapLogger(sink: PinoLogger): Logger {
  // Pino's default err serializer merges causes and manufactures a stack.
  // Our already-sanitized representation must pass through unchanged.
  sink = sink.child({}, { serializers: { err: (value) => value } });
  const methods = Object.fromEntries(
    levels.map((level) => [
      level,
      (context: Record<string, unknown>, event: string) => {
        try {
          if (!sink.isLevelEnabled(level)) return;
          // Event labels are static application strings; reject credentials even here.
          const message = /^[a-zA-Z_ ]{1,100}$/.test(event)
            ? event
            : "Log event";
          sink[level](
            redactSecrets(context, new WeakSet(), {
              fullContent: level === "trace",
              includeStack:
                process.env.NODE_ENV !== "production" ||
                sink.isLevelEnabled("debug"),
            }) as object,
            message,
          );
        } catch {
          // Diagnostics must never interrupt application work or retry a request.
        }
      },
    ]),
  ) as Omit<Logger, "isLevelEnabled">;
  return {
    ...methods,
    isLevelEnabled: (level) => {
      try {
        return sink.isLevelEnabled(level);
      } catch {
        return false;
      }
    },
  };
}

// Next instrumentation and route bundles can have separate module instances.
const loggerKey = Symbol.for("openmock.logger");
const registry = globalThis as typeof globalThis & {
  [key: symbol]: Logger | undefined;
};
const fallback = wrapLogger(
  pino({
    level: resolveLevel(
      process.env.NEXT_PUBLIC_LOG_LEVEL,
      process.env.NODE_ENV === "production",
    ),
    browser: { asObject: true },
  }),
);
export function installLogger(logger: Logger): void {
  registry[loggerKey] = logger;
}
const methods = Object.fromEntries(
  levels.map((level) => [
    level,
    (context: Record<string, unknown>, event: string) => {
      try {
        (registry[loggerKey] ?? fallback)[level](context, event);
      } catch {}
    },
  ]),
) as Omit<Logger, "isLevelEnabled">;
export const logger: Logger = {
  ...methods,
  isLevelEnabled: (level) => {
    try {
      return (registry[loggerKey] ?? fallback).isLevelEnabled(level);
    } catch {
      return false;
    }
  },
};
