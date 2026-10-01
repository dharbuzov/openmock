# OpenMock

**Free and open-source AI mock interviews for software engineers.**

Practice technical interviews with an AI interviewer that asks questions,
challenges your decisions, and adapts to your answers.

## Why OpenMock?

Interview preparation shouldn't require another subscription.

OpenMock is built to make realistic AI mock interviews freely available
to engineers, especially when preparing for their next role.

No courses. No endless content library.

Pick an interview and practice.

## Interviews

- **System Design** — design systems, explain trade-offs, and handle follow-up questions.
- **DSA** — solve coding problems while explaining your reasoning.

More interview types can be added over time.

## How it works

1. Choose an interview.
2. Start the interview room.
3. Talk through your solution.
4. Get challenged by the AI interviewer.
5. Review your performance and feedback.

## AI

OpenMock is designed around **Bring Your Own Key (BYOK)**.

Use your own supported AI provider instead of paying OpenMock for model usage.

Local models are also planned.

## Open Source

The interview experience is open source.

You can run OpenMock yourself, modify it, create new interview types,
and contribute improvements back to the community.

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Geist

## Status

🚧 **OpenMock is under active development.**

The project is currently focused on building the first usable version
of the interview experience.

## Development

```bash
git clone <repository-url>
cd openmock

npm install
npm run dev
```

## Application architecture

The current implementation supports browser-configured BYOK AI providers,
interactive DSA and System Design workspaces, adaptive interview turns, and
structured evidence-based evaluation. Voice, authentication, databases, and
code execution are intentionally out of scope.

- `content/interviews/`: interview definitions and instructions.
- `content/problems/`: community-owned Markdown content with validated YAML frontmatter.
- `content/prompts/`: global AI interviewer and evaluator prompts.
- `src/app/`: server-rendered pages and the thin interview API route.
- `src/components/`: interview panels, shared header, and shadcn UI primitives.
- `src/lib/interview/engine.ts`: application-level interview lifecycle orchestration.
- `src/lib/ai/`: provider/model resolution, prompts, generation, and structured evaluation.
- `src/lib/diagram/`: normalized architecture snapshots from the System Design canvas.

Try `/` → `/practice` → `/interview/two-sum` → `/results/two-sum`.
Interview IDs currently match problem IDs because persistent multi-session storage
is not part of this version. Completed evaluations are retained in browser session
storage and contain no provider credentials. Unknown IDs return 404.

`POST /api/interview` accepts JSON such as `{"problemId":"two-sum"}` and returns
an initialized interview with status 201. Invalid JSON or missing/invalid
`problemId` returns 400; unknown problems return 404.

Run checks with `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

`npm run check` runs lint, typecheck, tests, and dependency-cruiser boundary
validation. Run `npm run check:boundaries` separately to inspect dependency
violations, cycles, and unresolved imports. TypeScript aliases come from
`tsconfig.json`; type-only dependencies are included.

`npm run check:size` uses [scc](https://github.com/boyter/scc#install), which must
be installed on your PATH, to report production source code, comments, blanks,
and per-file sizes sorted by code lines. It excludes tests, generated files,
dependencies, and build output. Files over 300 or 500 code lines are inspection
signals, never quality gates. Semantic architecture decisions remain the
responsibility of the `openmock-architecture` skill.
