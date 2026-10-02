import { logger } from "../logging/logger";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PromptName } from "./prompt-loader";

export async function readPromptResource(
  name: PromptName,
  root = process.cwd(),
): Promise<string> {
  const filename = path.join(root, "content", "prompts", `${name}.md`);
  let prompt: string;
  try {
    prompt = (await readFile(filename, "utf8")).replace(/^\uFEFF/, "").trim();
  } catch (error) {
    logger.error(
      { operation: "read-prompt", name, err: error },
      "Prompt resource loading failed",
    );
    throw new Error(
      `Required prompt could not be loaded: content/prompts/${name}.md`,
      {
        cause: error,
      },
    );
  }
  if (!prompt)
    throw new Error(`Required prompt is empty: content/prompts/${name}.md`);
  return prompt;
}
