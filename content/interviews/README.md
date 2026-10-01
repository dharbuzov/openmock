# Adding an Interview Definition

Create one Markdown file directly in this directory. YAML frontmatter contains
the deterministic application metadata: identity, version, workspace capability,
duration, ordered stages, supported levels and modes, competencies, and allowed
recommendations. The Markdown body contains interviewer behavior, flow, level and
mode expectations, hint behavior, and evaluation guidance.

The application discovers every `.md` file here except this README. A content hash
becomes the definition revision automatically, so changing instructions changes
the revision even when the authored version is unchanged.

Problems reference a definition explicitly through their `interview` frontmatter
field. Adding a definition that uses an existing workspace capability requires no
TypeScript registration.
