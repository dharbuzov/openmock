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

DSA problems also require `language: java` and a `starterCode: |` YAML block
containing the Java starter source. The coding workspace displays that source
in `Solution.java` for Java 21. Code execution is not implemented.
