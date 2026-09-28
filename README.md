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

## Application skeleton

The current implementation is a routing and architecture demo. AI, voice,
authentication, storage, scoring, and editable workspaces are not implemented.

- `problems/`: community-owned Markdown content with validated YAML frontmatter.
- `src/app/`: server-rendered pages and the thin interview API route.
- `src/components/`: interview panels, shared header, and shadcn UI primitives.
- `src/lib/`: problem loading, the stateless dummy interview engine, and future AI/voice contracts.

Try `/` → `/practice` → `/interview/demo-two-sum` → `/results/demo-two-sum`.
All problem links use deterministic `demo-<problem-id>` IDs. Reloading rebuilds
the dummy object; completion only produces a results view and is not persisted.
Unknown IDs return 404. Problem bodies are displayed as plain Markdown in this skeleton.

`POST /api/interview` accepts JSON such as `{"problemId":"two-sum"}` and returns
a dummy interview with status 201. Invalid JSON or missing/invalid `problemId`
returns 400; unknown problems return 404. The UI uses direct links to the same
demo engine, so it does not need client-side session state.

Run checks with `npm run lint` and `npm run build` (includes TypeScript checking).
