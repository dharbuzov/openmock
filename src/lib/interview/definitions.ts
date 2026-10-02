import { logger } from "../logging/logger";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseInterviewDefinitionDocument } from "./definition-schema";
import type { InterviewDefinition } from "./types";
import { config } from "../config/config";

async function loadDefinition(filename: string): Promise<InterviewDefinition> {
  try {
    const parsed = parseInterviewDefinitionDocument(
      await readFile(filename, "utf8"),
    );
    logger.debug({ definitionId: parsed.id }, "Definition parsed");
    return parsed;
  } catch (error) {
    logger.error({ err: error }, "Definition validation failed");
    throw new Error(
      `Invalid interview definition ${path.relative(process.cwd(), filename)}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

export async function getInterviewDefinitions({
  includeDisabled = false,
} = {}): Promise<InterviewDefinition[]> {
  const directory = path.join(process.cwd(), "content", "interviews");
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".md") &&
        entry.name.toLowerCase() !== "readme.md",
    )
    .map((entry) => path.join(directory, entry.name))
    .sort();
  logger.debug({ count: files.length }, "Definitions discovered");
  const definitions = await Promise.all(files.map(loadDefinition));
  logger.debug({ count: definitions.length }, "Definitions loaded");
  const ids = new Set<string>();
  for (const definition of definitions) {
    if (ids.has(definition.id))
      throw new Error(`Duplicate interview definition id: ${definition.id}`);
    ids.add(definition.id);
  }
  return definitions
    .filter(
      (definition) =>
        includeDisabled || !config.interviews.disabled.includes(definition.id),
    )
    .sort(
      (a, b) =>
        (a.order ?? Infinity) - (b.order ?? Infinity) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );
}

export async function getInterviewDefinition(
  id: string,
): Promise<InterviewDefinition | undefined> {
  return (await getInterviewDefinitions()).find(
    (definition) => definition.id === id,
  );
}

export async function requireInterviewDefinition(
  id: string,
): Promise<InterviewDefinition> {
  const definition = await getInterviewDefinition(id);
  if (!definition) throw new Error(`Unknown interview definition: ${id}`);
  return definition;
}
