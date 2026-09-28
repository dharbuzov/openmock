import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { load, JSON_SCHEMA } from "js-yaml";
import { parseProblemMetadata } from "./schema";
import type { Problem } from "./types";

async function discoverFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return discoverFiles(filename);
    return entry.isFile() && entry.name.endsWith(".md") && entry.name.toLowerCase() !== "readme.md"
      ? [filename]
      : [];
  }));
  return files.flat().sort();
}

async function loadProblem(filename: string): Promise<Problem> {
  try {
    const source = (await readFile(filename, "utf8")).replace(/^\uFEFF/, "");
    const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(source);
    if (!match) throw new Error("Missing YAML frontmatter.");
    const metadata = parseProblemMetadata(load(match[1], { schema: JSON_SCHEMA }));
    if (!match[2].trim()) throw new Error("Problem body must not be empty.");
    return { ...metadata, content: match[2].trim() };
  } catch (error) {
    throw new Error(`Invalid problem ${path.relative(process.cwd(), filename)}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

export async function getProblems(): Promise<Problem[]> {
  const files = await discoverFiles(path.join(process.cwd(), "problems"));
  const problems = await Promise.all(files.map(loadProblem));
  const ids = new Set<string>();
  for (const problem of problems) {
    if (ids.has(problem.id)) throw new Error(`Duplicate problem id: ${problem.id}`);
    ids.add(problem.id);
  }
  return problems.sort((a, b) => a.title.localeCompare(b.title));
}

export async function getProblem(id: string): Promise<Problem | undefined> {
  return (await getProblems()).find((problem) => problem.id === id);
}
