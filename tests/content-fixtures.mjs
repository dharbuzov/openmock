import { readFileSync } from "node:fs";
import { load } from "./register-typescript.mjs";

const { parseInterviewDefinitionDocument } = load(
  "../src/lib/interview/definition-schema.ts",
);

export function loadDefinition(id) {
  return parseInterviewDefinitionDocument(
    readFileSync(
      new URL(`../content/interviews/${id}.md`, import.meta.url),
      "utf8",
    ),
  );
}
