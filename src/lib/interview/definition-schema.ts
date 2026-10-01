import { createHash } from "node:crypto";
import { load, JSON_SCHEMA } from "js-yaml";
import { z } from "zod";
import type {
  InterviewDefinition,
  InterviewLevelId,
  InterviewMode,
} from "./types";

const slugSchema = z
  .string()
  .trim()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "must be a lowercase, hyphen-separated slug",
  );
const nonEmptyString = z.string().trim().min(1);
const levelSchema = z.enum([
  "junior",
  "middle",
  "senior",
  "staff",
  "principal",
]);
const modeSchema = z.enum(["practice", "mock"]);
const recommendationSchema = z.enum([
  "strong-hire",
  "hire",
  "mixed",
  "no-hire",
  "strong-no-hire",
]);

const metadataSchema = z
  .object({
    id: slugSchema,
    name: nonEmptyString,
    version: z.number().int().positive(),
    workspace: z.enum(["diagram", "code", "project", "none"]),
    duration: z.object({ defaultMinutes: z.number().int().positive() }),
    stages: z.array(slugSchema).min(1),
    levels: z.array(levelSchema).min(1),
    modes: z.array(modeSchema).min(1),
    evaluation: z.object({
      recommendations: z.array(recommendationSchema).min(1),
      competencies: z
        .array(z.object({ id: slugSchema, name: nonEmptyString }))
        .min(1),
    }),
  })
  .superRefine((value, context) => {
    const unique = (
      values: string[],
      path: (string | number)[],
      label: string,
    ) => {
      if (new Set(values).size !== values.length)
        context.addIssue({
          code: "custom",
          path,
          message: `${label} must be unique`,
        });
    };
    unique(value.stages, ["stages"], "stage IDs");
    unique(value.levels, ["levels"], "levels");
    unique(value.modes, ["modes"], "modes");
    unique(
      value.evaluation.recommendations,
      ["evaluation", "recommendations"],
      "recommendations",
    );
    unique(
      value.evaluation.competencies.map(({ id }) => id),
      ["evaluation", "competencies"],
      "competency IDs",
    );
  });

function displayName(id: InterviewLevelId): string {
  return id === "middle" ? "Middle" : `${id[0].toUpperCase()}${id.slice(1)}`;
}

export function parseInterviewDefinitionDocument(
  source: string,
): InterviewDefinition {
  const normalized = source.replace(/^\uFEFF/, "");
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(
    normalized,
  );
  if (!match) throw new Error("Missing YAML frontmatter.");
  const instructions = match[2].trim();
  if (!instructions)
    throw new Error("Interview instructions must not be empty.");
  const parsed = metadataSchema.safeParse(
    load(match[1], { schema: JSON_SCHEMA }),
  );
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
  const metadata = parsed.data;
  return {
    ...metadata,
    revision: createHash("sha256").update(normalized).digest("hex"),
    stages: metadata.stages.map((id) => ({ id })),
    levels: metadata.levels.map((id) => ({ id, name: displayName(id) })),
    modes: metadata.modes as InterviewMode[],
    instructions,
  };
}
