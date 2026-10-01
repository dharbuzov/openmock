import { z } from "zod";

const environmentSchema = z.object({
  OPENMOCK_AI_PROVIDER: z
    .enum(["openai", "anthropic", "ollama"])
    .default("ollama"),
  OPENMOCK_AI_MODEL: z.string().trim().min(1).default("qwen3:8b"),
  OPENMOCK_DISABLED_INTERVIEWS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))),
});

export function parseConfig(environment: Record<string, string | undefined>) {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    throw new Error(
      `Invalid OpenMock configuration: ${result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return {
    ai: {
      provider: result.data.OPENMOCK_AI_PROVIDER,
      model: result.data.OPENMOCK_AI_MODEL,
    },
    interviews: { disabled: result.data.OPENMOCK_DISABLED_INTERVIEWS },
  };
}

export type AppConfig = ReturnType<typeof parseConfig>;
