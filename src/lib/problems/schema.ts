import type { ProblemMetadata } from "./types";

export function parseProblemMetadata(value: unknown): ProblemMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Frontmatter must be a YAML mapping.");
  }
  const { id, title, type, level, tags } = value as Record<string, unknown>;
  if (typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error("id must be a lowercase, hyphen-separated slug.");
  }
  if (typeof title !== "string" || !title.trim()) {
    throw new Error("title must be a non-empty string.");
  }
  if (type !== "dsa" && type !== "system-design") {
    throw new Error("type must be dsa or system-design.");
  }
  if (typeof level !== "string" || !level.trim()) {
    throw new Error("level must be a non-empty string.");
  }
  if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === "string" && tag.trim())) {
    throw new Error("tags must be an array of non-empty strings.");
  }
  const { language, starterCode } = value as Record<string, unknown>;
  if (type === "dsa" && (language !== "java" || typeof starterCode !== "string" || !starterCode.trim())) {
    throw new Error("DSA problems require language: java and non-empty starterCode.");
  }
  return {
    id, title: title.trim(), type, level: level.trim(), tags,
    ...(type === "dsa" ? { language: "java" as const, starterCode: starterCode as string } : {}),
  };
}
