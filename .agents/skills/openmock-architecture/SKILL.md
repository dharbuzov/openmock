---
name: openmock-architecture
description: >
  Review OpenMock for architectural drift, broken module boundaries,
  unnecessary abstractions, misplaced responsibilities, and violations
  of project-specific architectural rules. Use for architecture reviews
  and before large refactors. Report findings first; do not modify code.
---

# OpenMock Architecture Review

Review the OpenMock codebase for architectural drift.

Your job is NOT to redesign the system.

Your job is to identify concrete places where the implementation is
drifting away from the existing architecture and project conventions.

Do not modify code.
Do not move files.
Do not introduce abstractions.
Report findings first.

## Core principle

Prefer:

- simple modules
- explicit dependencies
- stable boundaries
- composition
- configuration-driven behavior
- existing abstractions
- deletion and consolidation

over:

- speculative abstractions
- generic frameworks
- factories
- unnecessary indirection
- duplicated concepts
- type-specific branching
- premature extensibility

Do not recommend an abstraction merely because one could exist.
Require concrete evidence that it solves an existing problem.

## Architecture invariants

### Interview engine

The interview engine must remain generic.

New interview types should primarily be introduced through interview
definitions/configuration rather than modifications to the generic engine.

Flag patterns such as:

```ts
if (definition.id === "behavioral") {
  ...
}
```

or:

```ts
switch (interview.type) {
  case "system-design":
  case "behavioral":
}
```

inside generic interview infrastructure.

Interview-specific behavior belongs to the interview definition whenever
reasonably possible.

The engine owns execution and state transitions.
Definitions own interview-specific behavior and instructions.

### AI

Generic AI infrastructure must not know about concrete interview types.

AI code should consume abstractions such as:

- InterviewContext
- InterviewDefinition
- Problem
- Workspace
- Evaluation configuration

rather than branching on specific interview IDs.

Runtime context construction belongs in code.
Do not move runtime state or application logic into prompts.

### Prompts

Global OpenMock system prompts live under:

`/content/prompts`

Prompt text should not be duplicated across TypeScript files.

Global prompts define platform-level AI behavior.
Interview-specific instructions remain owned by interview definitions.
Problem-specific context remains owned by problems.

Keep these responsibilities separate.

### Storage

Persistence mechanics and domain persistence are separate concerns.

Shared storage infrastructure belongs to:

`lib/storage`

It may contain primitives such as:

- Storage
- LocalStorage adapter

Shared storage must NOT know about domain types.

It must not import:

- Settings
- Interview
- Problem
- AISettings
- React components

Domain modules own their persisted data.

Examples:

`lib/settings/storage.ts`

`lib/interview/storage.ts`

A domain storage module may depend on the generic Storage abstraction.
The generic Storage abstraction must never depend on a domain module.

Do not create generic repository frameworks unless the codebase has a
real demonstrated need for them.

Flag unnecessary patterns such as:

- BaseRepository
- GenericRepository<T>
- RepositoryFactory
- StorageFactory
- persistence ORM-like abstractions

when simple domain storage is sufficient.

### UI

React components should primarily handle:

- rendering
- user interaction
- UI state
- composition

Flag substantial domain logic embedded inside components.
Flag direct persistence from components when the persisted state clearly
belongs to a domain module.
Flag components that directly implement interview engine behavior.

Do not demand extraction of trivial local UI logic.

### Tests

All automated tests must live under the root:

`/tests`

Production directories must not contain:

- `*.test.*`
- `*.spec.*`

Tests should follow the existing test structure.
Do not recommend colocated tests for this repository.

## Dependency direction

Look for dependencies pointing in the wrong direction.

Conceptually prefer:

UI
↓
domain/application modules
↓
infrastructure abstractions
↓
concrete infrastructure adapters

Examples of suspicious dependencies:

`lib/storage -> lib/settings`

`lib/storage -> lib/interview`

`lib/interview -> React components`

`lib/problems -> UI components`

generic AI infrastructure -> concrete interview type

domain modules -> browser localStorage directly

Do not enforce theoretical layering when no real boundary exists.
Judge dependencies based on actual module responsibilities.

## Duplication

Look for duplicated:

- domain concepts
- business rules
- prompt text
- parsing logic
- serialization logic
- state transitions
- configuration
- interfaces describing the same concept

Distinguish real duplication from coincidentally similar code.

Do not recommend abstraction until duplication represents the same
concept or behavior.

## Abstractions

Review existing abstractions critically.

Flag abstractions that:

- have only one implementation without a clear boundary benefit
- merely rename another API
- add indirection without hiding complexity
- exist only for hypothetical future requirements
- duplicate an existing abstraction
- expose more complexity than they encapsulate

However, a single implementation is NOT automatically a bad abstraction.

Interfaces that establish important boundaries — such as Storage or AI
provider contracts — may be valuable even with one current implementation.

## Module ownership

Every important behavior should have an obvious owner.

Look for behavior spread across unrelated modules.

Examples:

Settings persistence -> settings module

Interview transitions -> interview engine

Prompt loading -> prompt infrastructure

Problem parsing -> problems module

Generic persistence mechanics -> storage module

UI behavior -> components

Flag responsibilities that have no clear owner or multiple competing owners.

## File structure

Do not recommend reorganizing directories merely for aesthetic consistency.

A file move must improve an actual module boundary or fix misplaced ownership.

Focused changes must not cause unrelated repository restructuring.

Treat large unrelated file moves as architectural churn.

## Complexity

Look for:

- unnecessary wrappers
- deep call chains
- excessive indirection
- large functions with multiple responsibilities
- boolean mode explosions
- duplicated state
- unnecessary state synchronization
- abstractions leaking implementation details

Prefer the smallest change that fixes the underlying issue.

## Extensibility test

For architecture related to interviews, ask:

> What would happen if OpenMock added a new interview type tomorrow?

For example:

`behavioral`

A healthy architecture should allow most interview-specific behavior to
be added through its definition/configuration.

If adding a new interview type requires modifications throughout generic
engine, AI, UI, or persistence infrastructure, identify the coupling.

Do NOT propose speculative generic infrastructure merely to pass this test.

## Review procedure

First inspect the repository structure and existing conventions.

Then inspect dependencies and responsibilities.

Then look for concrete violations of the invariants above.

Do not begin with a predetermined refactoring.

For every finding:

1. identify the exact location
2. explain the architectural issue
3. explain why it matters
4. suggest the smallest reasonable correction
5. estimate whether it should be fixed now or can wait

## Severity

Classify findings as:

### Critical

Architecture currently permits incorrect behavior, broken ownership,
serious coupling, or makes core functionality unsafe to change.

### Important

Clear architectural drift that will increase maintenance cost or make
near-term features harder.

### Minor

A real issue, but fixing it now provides limited value.

Do NOT invent findings to populate every severity.
An architecture review with zero Critical findings is completely valid.

## Output

Return:

# Architecture Review

## Critical
...

## Important
...

## Minor
...

## Healthy Decisions

Call out architectural decisions that are working well and should be
preserved.

## Recommended Next Actions

Provide a short ordered list of concrete actions.

Prefer 1–5 meaningful actions over a large backlog.

## Final rules

Do not modify code.
Do not perform broad refactors.
Do not propose a rewrite.
Do not introduce patterns solely because they are considered "best practices".
Do not optimize for theoretical architectural purity.

Optimize for OpenMock remaining simple, understandable, extensible,
and easy for both humans and coding agents to modify.
