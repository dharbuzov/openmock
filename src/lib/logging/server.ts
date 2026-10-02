import pino from "pino";
import { installLogger, resolveLevel, wrapLogger } from "./logger";

export function configureServerLogger(): void {
  const level = resolveLevel(
    process.env.LOG_LEVEL,
    process.env.NODE_ENV === "production",
  );
  const streams = [
    { stream: pino.destination({ dest: 1, sync: true }), level },
  ];
  if (process.env.LOG_TO_FILE === "true") {
    try {
      streams.push({
        stream: pino.destination({
          dest: process.env.LOG_FILE || "./logs/openmock.log",
          mkdir: true,
          sync: true,
        }),
        level,
      });
    } catch {
      const fallback = wrapLogger(pino({ level }));
      fallback.warn({ reason: "file-unavailable" }, "File logging unavailable");
    }
  }
  installLogger(
    wrapLogger(
      pino(
        { level, base: { application: "openmock" } },
        pino.multistream(streams),
      ),
    ),
  );
}
