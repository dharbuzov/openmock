export const promptNames = ["interviewer", "evaluator"] as const;
export type PromptName = (typeof promptNames)[number];

export function isPromptName(value: string): value is PromptName {
  return (promptNames as readonly string[]).includes(value);
}

const prompts = new Map<PromptName, Promise<string>>();

export function loadPrompt(name: PromptName): Promise<string> {
  const existing = prompts.get(name);
  if (existing) return existing;
  const pending = fetch(`/api/prompts/${name}`).then(async (response) => {
    if (!response.ok)
      throw new Error(
        `Required prompt could not be loaded: ${name} (${response.status})`,
      );
    const prompt = (await response.text()).trim();
    if (!prompt) throw new Error(`Required prompt is empty: ${name}`);
    return prompt;
  });
  prompts.set(name, pending);
  return pending;
}
