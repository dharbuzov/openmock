import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseInterviewDefinitionDocument } from "./definition-schema";
import type { InterviewDefinition } from "./types";
import { config } from "../config/config";

async function loadDefinition(filename: string): Promise<InterviewDefinition> {
  try {
    return parseInterviewDefinitionDocument(await readFile(filename, "utf8"));
  } catch (error) {
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
  const definitions = await Promise.all(files.map(loadDefinition));
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
    .sort((a, b) => a.name.localeCompare(b.name));
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
