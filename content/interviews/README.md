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

Keep approximate pacing, natural transition expectations, and stage entry activities
in the Markdown Flow sections. No YAML stage budgets are needed. The interviewer
receives active elapsed time, remaining time, stage position, stage time, remaining
stages, and any engine-planned transition. It recommends readiness; the engine
advances at the next candidate-turn boundary before generating the next response.

The generic backstop allocates remaining time across remaining stages, permits up
to 50% extension while reserving half a nominal share for later stages, and bounds
one stage to eight answered interviewer turns. Each stage must first offer a
question and receive a candidate response; time alone never silently skips it.
Pauses do not consume active time. These safeguards are deliberately independent
of interview type and are not the definition's preferred pacing. Definitions can
ask for earlier advancement through their Flow guidance. Always explicitly offer
workspace activities such as drawing, coding, or querying in the appropriate stage.

Practice navigation uses each definition's `name`, optional `description`, Lucide
`icon` identifier, and integer `order`. Lower orders appear first; definitions
without an order follow, sorted by name and then ID. For example:

```yaml
id: sql
name: SQL
description: Query and model relational data
icon: database
order: 40
```

Icons resolve through the generic UI Lucide registry. Missing or unknown icons
use CircleHelp. Every enabled definition appears, including those with zero
problems. Add problems with `interview: sql` to populate that type's list.

Each definition must explicitly declare defaults alongside its existing arrays:

```yaml
defaultLevel: senior
levels:
  - middle
  - senior
defaultMode: practice
modes:
  - practice
  - mock
```

Both defaults must refer to entries in their respective non-empty arrays.
Invalid defaults fail when the definition is loaded.

Evaluation competencies are expected and required by default. Set `required: false`
on a competency only when it is optional for the interview's hiring decision.
The evaluator determines whether a meaningful opportunity existed from the
definition, interview path, messages, workspace, and end reason. Missing expected
evidence despite an opportunity is `not-demonstrated` (a negative candidate signal).
No meaningful opportunity is `not-assessed` (not automatically candidate failure).
Keep the existing qualitative ratings and holistic recommendation; do not average
ratings or use hiring recommendations to represent technical evaluation failure.
