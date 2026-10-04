# OpenMock

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-App_Router-black?logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
![Status: Active development](https://img.shields.io/badge/Status-Active_development-orange)

**Free and open-source AI mock interviews for software engineers.**

Practice with an AI interviewer that asks questions, challenges your decisions,
and adapts to your answers. Choose a problem, explain your approach, and review
feedback grounded in your conversation and workspace.

OpenMock is under active development. You can run it locally, add interview
content, and contribute improvements.

## Interviews

- **System Design** — design systems, explain trade-offs, and answer follow-up questions.
- **DSA** — solve coding problems while explaining your reasoning.
- **Behavioral** — discuss your experience, decisions, and collaboration.

## How it works

1. Configure your AI provider in Settings.
2. Choose a practice problem and start an interview.
3. Explain your solution and work in the code or diagram workspace when needed.
4. Answer follow-up questions from the AI interviewer.
5. Finish the interview to review evidence-based feedback.

## AI providers

OpenMock supports **Bring Your Own Key (BYOK)** with OpenAI and Anthropic,
as well as local models through Ollama. Provider settings are configured in the
browser. OpenMock does not charge a subscription; cloud providers charge for
model usage according to their own pricing.

## Tech stack

Next.js App Router, TypeScript, React, Tailwind CSS, shadcn/ui, and Geist.
The code workspace uses Monaco, and the diagram workspace uses Excalidraw.

## Architecture

OpenMock is a modular monolith that separates the **interview engine** from
**interview content**.

The engine manages interview state, stage progression, workspace snapshots,
and evaluation orchestration. It uses interview definitions rather than branching
on specific interview types such as System Design, DSA, or Behavioral.
The AI layer builds prompts and generates structured responses; the engine
validates and applies those responses.

```text
content/
├── interviews/    # Interview definitions and instructions
├── problems/      # Practice problems and interviewer context
└── prompts/       # Global interviewer and evaluator prompts

src/
├── app/           # Pages and API routes
├── components/    # Interview panels, workspaces, and UI primitives
└── lib/
    ├── interview/ # Definitions, lifecycle, and domain result validation
    ├── ai/        # Model selection, prompts, generation, and evaluation
    ├── problems/  # Problem discovery, loading, and validation
    ├── diagram/   # Diagram snapshot normalization
    ├── settings/  # Provider settings and their persistence
    └── storage/   # Shared browser storage primitives
```

### Definition-driven interviews

Each Markdown interview definition describes:

- Stages and their order.
- Interviewer instructions.
- Supported modes and target levels.
- Workspace requirements.
- Evaluation competencies and allowed recommendations.

Adding an interview type that uses an existing workspace capability requires
content changes without TypeScript registration. A new workspace capability may
also require application code.

Problems contain YAML metadata, candidate-facing Markdown, and optional hidden
interviewer context. Each problem references an interview definition through its
`interview` field. Global prompts define behavior shared across interview types.

See the [content guide](./content/README.md) for directory details and links to
instructions for adding definitions and problems.

### Module boundaries

Environment variables are read only by the configuration layer.
Application modules consume typed configuration instead of process.env.

- Keep the engine independent of concrete interview types.
- Prefer definitions and composition over type-specific branching.
- Keep model selection independent of concrete interview definitions.
- Keep domain rules in library modules and UI interactions in components.
- Keep shared storage primitives independent of domain modules and React.
- Prefer small, explicit abstractions over speculative frameworks.

Provider settings, layout preferences, and evaluation persistence remain owned
by their respective modules, using shared storage primitives. Completed
evaluations are retained in browser session storage and contain no provider
credentials. Interview IDs currently match problem IDs.

Voice, authentication, server-side databases, and code execution are outside
the current implementation.

## Development

```bash
git clone https://github.com/dharbuzov/openmock.git
cd openmock
npm install
cp .env.example .env.local
npm run dev
```

Open [localhost:3000](http://localhost:3000), configure your provider in Settings,
and visit `/practice` to choose a problem.

### Configuration

Deployment defaults are validated in `src/lib/config/`. Set these variables in
`.env.local` or your deployment environment:

| Variable                       | Default    | Purpose                                               |
| ------------------------------ | ---------- | ----------------------------------------------------- |
| `OPENMOCK_AI_PROVIDER`         | `ollama`   | Default provider: `ollama`, `openai`, or `anthropic`. |
| `OPENMOCK_AI_MODEL`            | `qwen3:8b` | Non-empty model ID for the default provider.          |
| `OPENMOCK_DISABLED_INTERVIEWS` | Empty      | Comma-separated interview definition IDs to disable.  |

Settings can override AI defaults. Disabled interviews and their problems are
excluded from discovery and cannot be enabled through Settings. Whitespace and
empty entries in the disabled list are ignored. Unknown, well-formed IDs are
allowed so configuration stays independent of the content catalog.

AI defaults are public and included in the browser bundle at build time; rebuild
when changing them. Choose a model appropriate for the configured provider.

### Checks

```bash
npm run check         # ESLint, TypeScript, tests, and dependency boundaries
npm run format:check  # Check Prettier formatting
npm run format        # Apply Prettier formatting
npm run build         # Build the production application
```

All automated tests live under the root `tests/` directory.

`npm run check:boundaries` runs dependency-cruiser to check module boundaries,
dependency cycles, and unresolved imports. It reads TypeScript aliases from
`tsconfig.json` and includes type-only dependencies. Semantic architecture
decisions remain part of the `openmock-architecture` skill review.

`npm run check:size` produces an informational source-size report using
[scc](https://github.com/boyter/scc#install), which must be installed on your PATH.
It excludes tests, generated files, dependencies, and build output. Files over
300 or 500 code lines are signals to inspect, never quality gates.

### Interview API

`POST /api/interview` accepts JSON such as `{"problemId":"two-sum"}` and returns
an initialized interview with status `201`. Invalid JSON or missing/invalid
`problemId` returns `400`; unknown problems return `404`.

## Local Voice

Run OpenMock and CPU-only Whisper/Kokoro with `docker compose up --build`.
Audio is sent directly to the configured local Speech service; the LLM provider
remains independent. See [Local Voice](docs/local-voice.md) for configuration,
manual STT/TTS checks, privacy, resource measurement, and troubleshooting.

## License

Copyright 2026 OpenMock contributors.

Licensed under the [Apache License, Version 2.0](./LICENSE).

## Logging

OpenMock uses Pino through `src/lib/logging/logger.ts`. Browser AI requests remain
direct BYOK requests; logs never go to a collector or the OpenMock backend.
Next.js routes and content loaders run on Node; the interview engine is shared.
There is no NestJS service.

Levels: trace, debug, info, warn, error, fatal. Defaults are debug in development
and info in production; invalid levels fall back to info. Set `LOG_LEVEL=debug`
before starting Next.js. The same level is inlined into browser builds; rebuild
production assets to change browser verbosity. `NEXT_PUBLIC_LOG_LEVEL` is an
alternative browser setting when LOG_LEVEL is unset.

Node logs are JSON on stdout. Enable `LOG_TO_FILE=true` to additionally write JSON
to `LOG_FILE` (default `./logs/openmock.log`, relative to the working directory).
Pino creates the directory. File logging falls back to stdout with a warning if
opening the destination fails. Enable it only on hosts with writable persistent
filesystems; serverless deployments should normally use stdout. Files are ignored
by Git; deployment operators must manage retention/rotation. Browser logs are
structured console objects and cannot write local files.

Logging accepts a static event label and structured context. Targeted redaction
removes credential fields (API keys, Authorization, cookies, tokens, passwords
and provider credentials) and recognizable/configured secret values in strings.
Normal prompts, messages, definitions, workspace data and model output remain
intact without truncation. Getters and circular references are not serialized.

At DEBUG/TRACE verbosity, every interviewer turn, evaluation and connection test
logs a full AI request and response with a shared requestId and durationMs.
Interview calls also include interviewId, stageId, targetLevel and workspace.
For V3 providers, logs include the SDK provider parameters and raw provider result
before parsing/schema validation, including available wire request/response bodies.
Failures include the same request/available response at debug verbosity.
Production INFO logs keep metadata, errors and evaluation diagnostics; payload
logs require explicitly enabling DEBUG/TRACE.

Error serialization preserves sanitized messages, names, codes/statuses and bounded
causes without arbitrary SDK config/request objects. Sanitized stack frames appear
in development or DEBUG/TRACE mode. Evaluation diagnostics include response length,
parse/validation outcomes and sanitized issue paths/messages.

## Interview lifecycle

`lib/interview/engine.ts` owns state transitions and validates definition identity,
workspace capability and active stages. It has no AI/settings/logging dependencies.
`runner.ts` coordinates AI turns and evaluation with metadata-only operational logs;
AI boundary DEBUG payload logging remains separate.

Definitions explicitly declare `defaultLevel` and `defaultMode`, validated against
their available arrays during loading. The final stage clears `stage.current` to
`null`; further turns are rejected. Candidate completion is independent of evaluation.
`finishInterview` returns a completed interview plus an evaluation outcome with
`status: completed | failed`. A failed outcome is safe to display and never restores
the interview to in-progress.

The room persists the completed session and finish-time workspace even when evaluation
fails. Its Retry evaluation action calls `retryEvaluation` on that same completed
interview and snapshot, including after a reload. Successful evaluation keeps the existing
results format and route. Definition edits change their revision, so existing sessions
bound to an earlier revision must be restarted rather than silently migrated.
