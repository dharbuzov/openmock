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
        if (!sink.isLevelEnabled(level)) return;
        // Event labels are static application strings; reject credentials even here.
        const message = /^[a-zA-Z ]{1,100}$/.test(event) ? event : "Log event";
        sink[level](
          redactSecrets(context, new WeakSet(), {
            includeStack:
              process.env.NODE_ENV !== "production" ||
              sink.isLevelEnabled("debug"),
          }) as object,
          message,
        );
      },
    ]),
  ) as Omit<Logger, "isLevelEnabled">;
  return { ...methods, isLevelEnabled: (level) => sink.isLevelEnabled(level) };
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
    (context: Record<string, unknown>, event: string) =>
      (registry[loggerKey] ?? fallback)[level](context, event),
  ]),
) as Omit<Logger, "isLevelEnabled">;
export const logger: Logger = {
  ...methods,
  isLevelEnabled: (level) =>
    (registry[loggerKey] ?? fallback).isLevelEnabled(level),
};
