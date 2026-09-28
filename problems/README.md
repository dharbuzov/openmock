# Adding a Problem

Create a Markdown file in the appropriate directory:

- `system-design/`
- `dsa/`

Add frontmatter:

```yaml
---
id: message-broker
title: Design a Message Broker
type: system-design
level: senior
tags:
- distributed-systems
---
```

Then write the problem using Markdown and open a pull request.

The application recursively discovers `.md` files here, excluding `README.md`.
Each file must have a unique lowercase, hyphen-separated `id`, a non-empty
`title` and `level`, a `type` of `dsa` or `system-design`, a string array of
`tags`, and a non-empty Markdown body. Invalid content reports its file path.
The Markdown files are the only problem catalog; no TypeScript registration is needed.

DSA problems also require `language: java` and a `starterCode: |` YAML block
containing the Java starter source. The coding workspace displays that source
in `Solution.java` for Java 21. Code execution is not implemented.
