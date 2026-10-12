---
id: valid-parentheses
title: Valid Parentheses
interview: dsa
difficulty: easy
categories:
  - algorithms
topics:
  - blind-75
  - strings
  - stacks
companies: []
language: java
starterCode: |
  class Solution {
      public boolean isValid(String s) {
          throw new UnsupportedOperationException("Not implemented");
      }
  }
---

## Description

Given a string containing only `(`, `)`, `[`, `]`, `{`, and `}`, determine whether
every opening bracket has a matching closing bracket of the same type and all
pairs are correctly nested. The empty string is valid.

### Examples

```text
Input: s = "{[()]}[]"
Output: true

Input: s = "([)]"
Output: false

Input: s = "(("
Output: false

Input: s = ""
Output: true
```

### Constraints

- `0 <= s.length <= 10000`.
- No letters, spaces, or other characters occur in the input.
- Matching bracket counts alone do not establish validity.

### Edge Cases

Consider a leading closing bracket, an unmatched opening bracket at the end,
deep nesting, adjacent pairs, and equal counts with incorrect nesting.

## Discussion

Explain how your state represents unfinished pairs and how you detect both
premature closing and incomplete input.

# Interviewer Context

Assess ordering and nesting reasoning; do not provide a stack implementation.

- Junior: recognize why equal counts are insufficient and handle unmatched brackets safely.
- Middle: implement a linear-time check with correct pair types and final-state validation.
- Senior: state an invariant for unfinished openings and explain worst-case memory use for deeply nested input.
- Staff / Principal: explore incremental validation or reporting the first error position if useful. Do not require parser construction beyond the stated task.
- Request a trace of `([)]` and a leading closing bracket. This easy problem may expose limited evidence for advanced competencies.
