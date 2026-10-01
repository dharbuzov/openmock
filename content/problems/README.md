# Adding a Problem

Create a Markdown file in the appropriate directory:

- `system-design/`
- `dsa/`

Add frontmatter:

```yaml
---
id: message-broker
title: Design a Message Broker
interview: system-design
complexity: medium
tags:
- distributed-systems
---
```

Then write the problem using Markdown and open a pull request.

The application recursively discovers `.md` files here, excluding `README.md`.
Each file must have a unique lowercase, hyphen-separated `id`, a non-empty
`title`, an interview definition id, a `complexity` of `low`, `medium`, or
`high`, and a non-empty Markdown body. `categories`, `topics`, `companies`,
and `tags` are optional and default to empty arrays. Invalid content reports
its file path. Legacy `type`/`level` frontmatter remains readable during migration.
The Markdown files are the only problem catalog; no TypeScript registration is needed.

Problems used with a `code` workspace may optionally provide `language` and a
`starterCode: |` YAML block. The current coding workspace uses that source as
its initial buffer. Code execution is not implemented.

Add a `# Interviewer Context` heading after the candidate-facing Markdown when
the interviewer needs hidden constraints or follow-up guidance. That section is
passed to the AI interviewer and is never rendered in the candidate problem panel.
