import { z } from "zod";
import { load, JSON_SCHEMA } from "js-yaml";
import type { Problem, ProblemMetadata } from "./types";

const slugSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "must be a lowercase, hyphen-separated slug",
  );
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
  type: slugSchema.optional(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  level: z.enum(["junior", "mid", "senior", "staff", "principal"]).optional(),
  categories: stringList,
  topics: stringList,
  companies: z
    .array(
      z.union([
        companySchema,
        nonEmptyString.transform((id) => ({
          id,
          relation: "relevant" as const,
        })),
      ]),
    )
    .default([]),
  tags: stringList,
  interviewerContext: nonEmptyString.optional(),
  language: nonEmptyString.optional(),
  starterCode: nonEmptyString.optional(),
});

export function parseProblemMetadata(value: unknown): ProblemMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Frontmatter must be a YAML mapping.");
  }
  const input = value as Record<string, unknown>;
  const parsed = normalizedMetadataSchema.safeParse({
    ...input,
    interview: input.interview ?? input.type,
    categories: input.categories ?? [],
    topics: input.topics ?? [],
    companies: input.companies ?? [],
    tags: input.tags ?? [],
  });
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues
        .map(
          (issue) =>
            `${issue.path.join(".") || "frontmatter"} ${issue.message}`,
        )
        .join("; "),
    );
  }
  return parsed.data;
}

export function parseProblemDocument(source: string): Problem {
  const normalized = source.replace(/^\uFEFF/, "");
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(
    normalized,
  );
  if (!match) throw new Error("Missing YAML frontmatter.");
  const metadata = parseProblemMetadata(
    load(match[1], { schema: JSON_SCHEMA }),
  );
  const body = match[2].trim();
  const contextHeading = /^# Interviewer Context\s*$/m.exec(body);
  const content = (
    contextHeading ? body.slice(0, contextHeading.index) : body
  ).trim();
  if (!content) throw new Error("Problem body must not be empty.");
  const sectionContext = contextHeading
    ? body.slice(contextHeading.index + contextHeading[0].length).trim()
    : undefined;
  const { interviewerContext: frontmatterContext, ...publicMetadata } =
    metadata;
  return {
    ...publicMetadata,
    content,
    ...(sectionContext || frontmatterContext
      ? { interviewerContext: sectionContext || frontmatterContext }
      : {}),
  };
}
