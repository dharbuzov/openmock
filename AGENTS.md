# OpenMock

Open-source AI-powered technical interview practice platform.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui

## Engineering

- Follow Next.js conventions.
- Prefer Server Components by default.
- Use Client Components only when required.
- Keep the application a simple modular monolith.
- Prefer simple composition over abstractions.
- Do not add features or dependencies unless needed.

## Design

Use the Geist design system as the primary visual language.

Use shadcn/ui for implementation primitives.

OpenMock should feel like professional developer tooling:
precise, minimal, compact, and functional.

Application interfaces should resemble developer tools rather than SaaS dashboards.

Prefer:
- Geist typography
- monochrome surfaces
- thin separators
- compact controls
- strong alignment
- whitespace over decoration
- workspace-oriented layouts

Avoid:
- generic SaaS cards
- gradients
- glassmorphism
- excessive shadows
- excessive border radius
- decorative AI elements
- purple AI aesthetics
- unnecessary animations

For the Interview Room:
- use `Problem | Workspace | AI Interviewer`
- make the workspace the dominant surface
- prefer separators over cards

If the result resembles a generic AI SaaS template or Dribbble concept,
the design is incorrect.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

