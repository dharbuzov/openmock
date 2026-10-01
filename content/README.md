# OpenMock Content

This directory contains the Markdown resources used by OpenMock at runtime.

- [`interviews/`](./interviews/README.md) contains interview definitions. Each
  definition combines YAML metadata (stages, workspace capabilities, supported
  levels and modes, and evaluation criteria) with Markdown instructions for the
  interviewer. Definitions are discovered directly from this directory.
- [`problems/`](./problems/README.md) contains practice problems, grouped by
  interview type. Each problem includes YAML metadata and candidate-facing
  Markdown, and references an interview definition through its `interview` field.
  Problems are discovered recursively. An optional `# Interviewer Context`
  section provides guidance that is hidden from the candidate.
- `prompts/` contains global AI instructions shared across interview types.
  [`interviewer.md`](./prompts/interviewer.md) defines platform-wide interviewer
  behavior, while [`evaluator.md`](./prompts/evaluator.md) defines how interview
  evidence is assessed. Interview-specific instructions belong in `interviews/`;
  problem-specific context belongs in `problems/`.

See the directory READMEs above for instructions on adding definitions and
problems. README files are excluded from content discovery.
