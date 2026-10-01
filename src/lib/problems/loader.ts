import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseProblemDocument } from "./schema";
import type { Problem } from "./types";
import { getInterviewDefinitions } from "../interview/definitions";
import type { InterviewDefinition } from "../interview/types";

export function validateProblemDefinitions(
  problems: Problem[],
  definitions: InterviewDefinition[],
): void {
  const definitionIds = new Set(definitions.map(({ id }) => id));
  for (const problem of problems) {
    if (!definitionIds.has(problem.interview)) {
      throw new Error(
        `Problem ${problem.id} references unknown interview definition: ${problem.interview}`,
      );
    }
  }
}

async function discoverFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) return discoverFiles(filename);
      return entry.isFile() &&
        entry.name.endsWith(".md") &&
        entry.name.toLowerCase() !== "readme.md"
        ? [filename]
        : [];
    }),
  );
  return files.flat().sort();
}

async function loadProblem(filename: string): Promise<Problem> {
  try {
    return parseProblemDocument(await readFile(filename, "utf8"));
  } catch (error) {
    throw new Error(
      `Invalid problem ${path.relative(process.cwd(), filename)}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

export async function getProblems(): Promise<Problem[]> {
  const files = await discoverFiles(path.join(process.cwd(), "problems"));
  const problems = await Promise.all(files.map(loadProblem));
  const ids = new Set<string>();
  for (const problem of problems) {
    if (ids.has(problem.id))
      throw new Error(`Duplicate problem id: ${problem.id}`);
    ids.add(problem.id);
  }
  validateProblemDefinitions(problems, await getInterviewDefinitions());
  return problems.sort((a, b) => a.title.localeCompare(b.title));
}

export async function getProblem(id: string): Promise<Problem | undefined> {
  return (await getProblems()).find((problem) => problem.id === id);
}
