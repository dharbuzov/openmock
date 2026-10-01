---
name: openmock-simplify
description: >
  Simplify OpenMock code without changing behavior or redesigning architecture.
  Remove accidental complexity, duplication, dead code, unnecessary wrappers,
  and weak abstractions. Prefer smaller code and existing primitives.
---

# OpenMock Simplify

Simplify the code while preserving behavior and existing architectural boundaries.

Unlike an architecture review, this skill MAY modify code.

The goal is not to make the code more "architectural".
The goal is to make it smaller, clearer, and easier to maintain.

## Core principle

Prefer, in this order:

1. delete
2. reuse
3. inline
4. merge
5. simplify
6. extract only when it clearly improves the code

Prefer existing primitives over new abstractions.

Do not introduce an abstraction merely because code looks similar.

## Look for

- dead code
- unused exports
- redundant types
- duplicated logic representing the same concept
- unnecessary wrappers
- pass-through functions
- needless interfaces
- excessive indirection
- deeply nested conditionals
- boolean complexity
- repeated state transformations
- unnecessary state synchronization
- redundant fallback logic
- duplicated parsing or serialization
- verbose code that can be expressed more directly
- comments explaining unnecessarily complicated code that can instead be simplified
- helpers used once that make the code harder to follow
- abstractions that expose as much complexity as they hide

## Duplication

Do not mechanically DRY similar-looking code.

Only consolidate duplication when it represents the same concept, rule,
or responsibility.

Two pieces of code that happen to look similar may legitimately remain separate.

Prefer reusing an existing primitive over creating another helper.

## Abstractions

Be skeptical of:

- Base classes
- GenericRepository<T>
- factories with one meaningful implementation
- wrappers around wrappers
- interfaces that merely duplicate another API
- helpers that only rename an operation
- configuration layers with no current need
- speculative extension points

However, do not remove an abstraction simply because it currently has one implementation.

Keep abstractions that establish a useful boundary, such as:

- AI provider contracts
- Storage boundaries
- domain/infrastructure separation

Do not collapse intentional architecture while simplifying implementation details.

## Functions

Prefer functions that have one obvious purpose.

Simplify:

- deep nesting
- repeated guards
- unnecessary temporary variables
- duplicated branches
- boolean flag combinations
- large blocks that mix unrelated responsibilities

Use early returns when they improve readability.

Do not split functions into tiny helpers unless the extracted helper represents
a meaningful operation or significantly improves readability.

## Types

Prefer deriving types from existing domain contracts instead of redefining them.

Remove redundant aliases and duplicated unions when there is already a clear owner.

Do not weaken type safety merely to reduce lines of code.

Avoid unnecessary casts.

Do not replace explicit domain types with overly generic types.

## React / UI

Simplify component code without moving domain behavior into the UI.

Look for:

- duplicated derived state
- unnecessary effects
- state that can be derived during render
- duplicated handlers
- repeated context access
- unnecessary synchronization between state sources

Do not extract components merely to make files shorter.

Do not move domain logic into React components.

## Async code

Look for:

- duplicated loading/error state
- unnecessary Promise wrappers
- stale-result hazards
- repeated try/catch structures
- async flows that can be expressed more directly

Preserve concurrency and stale-result protections even if removing them would
make the code shorter.

Correctness beats fewer lines.

## OpenMock invariants

Simplification must preserve these project rules:

- interview behavior remains definition-driven
- generic AI code does not branch on concrete interview types
- UI does not own domain logic
- domain modules own domain persistence
- shared storage owns persistence mechanics only
- global prompts remain under `/prompts`
- tests remain under root `/tests`

Do not move files or redesign module boundaries as part of simplification.

If you discover an architectural problem, report it instead of silently
redesigning the architecture.

## Scope discipline

Only simplify code relevant to the requested scope or recently changed code.

Do not turn a focused simplification into a repository-wide refactor.

Do not:

- reorganize folders
- rename large public APIs without need
- introduce frameworks
- add dependency injection machinery
- create generic repository layers
- rewrite working modules
- change behavior to make implementation easier

Avoid formatting churn and unrelated edits.

## Safety

Before removing or merging code, check its usages.

Preserve:

- public behavior
- persisted data compatibility
- API contracts unless explicitly in scope
- error semantics
- interview state semantics
- concurrency protections

When uncertain whether two behaviors are equivalent, keep them separate.

## Tests

All tests must remain under `/tests`.

Update or add tests when simplification changes implementation in a way that
could accidentally alter behavior.

Do not rewrite tests merely to match a refactor if they are correctly testing
observable behavior.

Run relevant tests and typecheck after changes.

## Procedure

1. Inspect the requested scope and its usages.
2. Identify concrete accidental complexity.
3. Prefer deletion/reuse over extraction.
4. Make small behavior-preserving changes.
5. Run tests and typecheck.
6. Review the diff and remove unrelated churn.

## Output

After implementation, report:

### Simplified

List meaningful simplifications and why they are safer or clearer.

### Intentionally Left Alone

Mention tempting areas you deliberately did not abstract or refactor.

### Validation

Report tests and typecheck results.

### Architecture Notes

If you found architecture concerns outside simplification scope, list them here.
Do not fix them unless explicitly requested.

## Final rules

Do not optimize for minimum line count.

Optimize for minimum accidental complexity.

Do not create abstractions for hypothetical future use.

Do not perform architectural redesign.

Do not restructure unrelated code.

Prefer boring, obvious code.

Leave the codebase simpler than you found it.
