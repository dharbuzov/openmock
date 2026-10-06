import { logger } from "../logging/logger";
export const promptNames = ["interviewer", "evaluator"] as const;
export type PromptName = (typeof promptNames)[number];

export function isPromptName(value: string): value is PromptName {
  return (promptNames as readonly string[]).includes(value);
}

const prompts = new Map<PromptName, Promise<string>>();

export function loadPrompt(
  name: PromptName,
  context: Record<string, unknown> = {},
): Promise<string> {
  const existing = prompts.get(name);
  if (existing) return existing;
  const pending = fetch(`/api/prompts/${name}`)
    .then(async (response) => {
      if (!response.ok)
        throw new Error(
          `Required prompt could not be loaded: ${name} (${response.status})`,
        );
      const prompt = (await response.text()).trim();
      if (!prompt) throw new Error(`Required prompt is empty: ${name}`);
      return prompt;
    })
    .catch((error: unknown) => {
      logger.error(
        {
          ...context,
          component: "prompts",
          operation: "load-prompt",
          name,
          err: error,
        },
        "Prompt loading failed",
      );
      prompts.delete(name);
      throw error;
    });
  prompts.set(name, pending);
  return pending;
}
