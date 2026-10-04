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
difficulty: medium
categories:
  - distributed-systems
topics:
  - messaging
companies: []
---
```

Then write the problem using Markdown and open a pull request.

The application recursively discovers `.md` files here, excluding `README.md`.
Each file must have a unique lowercase, hyphen-separated `id`, a non-empty
`title`, an interview definition id, a `difficulty` of `easy`, `medium`, or
`hard`, and a non-empty Markdown body. `categories`, `topics`, and `companies`
are optional and default to empty arrays. Categories are broad classifications;
topics are specific concepts or skills. Both use lowercase, hyphen-separated IDs.
Invalid content reports its file path. `interview` must reference an existing
InterviewDefinition. Unknown fields are rejected; `type`, `level`, and `tags`
are not problem metadata. Difficulty is intrinsic to the problem. Target level
and mode belong to the session, initialized from user selections or definition
defaults. Definition names supply the UI Type label. Companies accept names or objects with `id`,
`relation`, and optional `source` provenance.
The Markdown files are the only problem catalog; no TypeScript registration is needed.

Problems may optionally override the interview definition's `duration.defaultMinutes`
with a positive integer number of minutes:

```yaml
duration:
  minutes: 45
```

The Catalog and Setup show this resolved duration. Starting an interview captures
it for that session and starts the countdown automatically. Pause/resume and
reload preserve the session's clock; later content edits do not change its duration.

Problems used with a `code` workspace may optionally provide `language` and a
`starterCode: |` YAML block. The current coding workspace uses that source as
its initial buffer. Code execution is not implemented.

Author the candidate statement, examples, and given constraints inside
`## Description`, using `###` headings for subsections. The panel shows only
the title, compact metadata badges, and this section. Other top-level sections
such as Functional Requirements, Scale, and Discussion remain available to AI.

Add a `# Interviewer Context` heading after the problem Markdown when
the interviewer needs hidden constraints or follow-up guidance. That section is
passed to the AI interviewer and is never rendered in the candidate problem panel.
