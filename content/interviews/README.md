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
in the Markdown Flow sections. Optional YAML `stagePacing` maps stage IDs to
positive relative weights; omitted weights default to 1. For example, a four-stage
definition can use weights 20, 45, 25, and 10 to reserve more time for its core
activity. Keep these weights consistent with the Flow guidance. The interviewer
receives active elapsed time, remaining time, stage position, stage time, remaining
stages, and any engine-planned transition. It returns structured readiness and a
response stage ID; the engine validates both at the current candidate-turn boundary.
When a new recommendation is approved, the response is regenerated against the
destination stage. Responses are held until validation and the authoritative
interview state is committed, so neither text nor voice can announce an uncommitted
transition. Both stage indicators read that same persisted interview state.

The generic backstop allocates remaining time across remaining stages, permits up
to 50% extension while reserving half the weighted remaining budget for later stages, and bounds
one stage to eight answered interviewer turns. Each stage must first offer a
question and receive a candidate response; time alone never silently skips it.
Pauses do not consume active time. These safeguards are deliberately independent
of interview type. Weights guide scheduling without requiring stages to consume
their entire allowance. Definitions can
ask for earlier advancement through their Flow guidance. Always explicitly offer
workspace activities such as drawing, coding, or querying in the appropriate stage.

Define target-level expectations in the Markdown Levels section. Merely listing
supported level IDs cannot establish an evaluation bar. Express expectations as
observable reasoning and behavior, without a separate level-by-competency matrix.

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
