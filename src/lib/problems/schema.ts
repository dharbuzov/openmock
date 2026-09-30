import { z } from "zod";
import { load, JSON_SCHEMA } from "js-yaml";
import type { Problem, ProblemComplexity, ProblemMetadata } from "./types";

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a lowercase, hyphen-separated slug");
const nonEmptyString = z.string().trim().min(1);
const stringList = z.array(nonEmptyString).default([]);

const companySchema = z.object({
  id: nonEmptyString,
  relation: z.enum(["reported", "similar", "relevant"]),
  source: nonEmptyString.optional(),
});

const normalizedMetadataSchema = z.object({
  id: slugSchema,
  title: nonEmptyString,
  interview: slugSchema,
  complexity: z.enum(["low", "medium", "high"]),
  categories: stringList,
  topics: stringList,
  companies: z.array(companySchema).default([]),
  tags: stringList,
  interviewerContext: nonEmptyString.optional(),
  language: nonEmptyString.optional(),
  starterCode: nonEmptyString.optional(),
});

function legacyComplexity(level: unknown): ProblemComplexity {
  if (typeof level !== "string") return "low";
  switch (level.trim().toLowerCase()) {
    case "medium": return "medium";
    case "hard":
    case "high": return "high";
    default: return "low";
  }
}

export function parseProblemMetadata(value: unknown): ProblemMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Frontmatter must be a YAML mapping.");
  }
  const input = value as Record<string, unknown>;
  const parsed = normalizedMetadataSchema.safeParse({
    ...input,
    interview: input.interview ?? input.type,
    complexity: input.complexity ?? legacyComplexity(input.level),
    categories: input.categories ?? [],
    topics: input.topics ?? [],
    companies: input.companies ?? [],
    tags: input.tags ?? [],
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => `${issue.path.join(".") || "frontmatter"} ${issue.message}`).join("; "));
  }
  if (parsed.data.interview === "dsa" && (!parsed.data.language || !parsed.data.starterCode)) {
    throw new Error("DSA problems require a language and non-empty starterCode.");
  }
  return parsed.data;
}

export function parseProblemDocument(source: string): Problem {
  const normalized = source.replace(/^\uFEFF/, "");
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(normalized);
  if (!match) throw new Error("Missing YAML frontmatter.");
  const metadata = parseProblemMetadata(load(match[1], { schema: JSON_SCHEMA }));
  const content = match[2].trim();
  if (!content) throw new Error("Problem body must not be empty.");
  return { ...metadata, content };
}
