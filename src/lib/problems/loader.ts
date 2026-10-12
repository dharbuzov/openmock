import { logger } from "../logging/logger";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseProblemDocument } from "./schema";
import type { Problem } from "./types";
import { getInterviewDefinitions } from "../interview/definitions";
import type { InterviewDefinition } from "../interview/types";

export function validateProblemDefinitions(
  problems: Problem[],
  definitions: InterviewDefinition[],
  filenames?: string[],
): void {
  const definitionsById = new Map(
    definitions.map((definition) => [definition.id, definition]),
  );
  for (const [index, problem] of problems.entries()) {
    const location = filenames?.[index] ?? problem.id;
    const definition = definitionsById.get(problem.interview);
    if (!definition) {
      logger.warn(
        { problemId: problem.id, definitionId: problem.interview },
        "Problem references unknown interview definition",
      );
      throw new Error(
        `Invalid problem ${location}: interview references unknown interview definition: ${problem.interview}`,
      );
    }
    for (const field of ["language", "starterCode"] as const) {
      if (problem[field] !== undefined && definition.workspace !== "code") {
        throw new Error(
          `Invalid problem ${location}: ${field} requires an interview definition with a code workspace`,
        );
      }
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
    const parsed = parseProblemDocument(await readFile(filename, "utf8"));
    logger.debug({ problemId: parsed.id }, "Problem parsed");
    return parsed;
  } catch (error) {
    logger.error({ err: error }, "Problem validation failed");
    throw new Error(
      `Invalid problem ${path.relative(process.cwd(), filename)}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

export async function getProblems(): Promise<Problem[]> {
  const files = await discoverFiles(
    path.join(process.cwd(), "content", "problems"),
  );
  logger.debug({ count: files.length }, "Problems discovered");
  const problems = await Promise.all(files.map(loadProblem));
  logger.debug({ count: problems.length }, "Problems loaded");
  const ids = new Map<string, string>();
  for (const [index, problem] of problems.entries()) {
    const filename = path.relative(process.cwd(), files[index]);
    const previous = ids.get(problem.id);
    if (previous !== undefined)
      throw new Error(
        `Invalid problem ${filename}: Duplicate problem id: ${problem.id} (already defined in ${previous})`,
      );
    ids.set(problem.id, filename);
  }
  const definitions = await getInterviewDefinitions({ includeDisabled: true });
  validateProblemDefinitions(
    problems,
    definitions,
    files.map((filename) => path.relative(process.cwd(), filename)),
  );
  const available = new Set(
    (await getInterviewDefinitions()).map(({ id }) => id),
  );
  return problems
    .filter((problem) => available.has(problem.interview))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function getProblem(id: string): Promise<Problem | undefined> {
  return (await getProblems()).find((problem) => problem.id === id);
}
