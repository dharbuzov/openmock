---
id: climbing-stairs
title: Climbing Stairs
interview: dsa
difficulty: easy
categories:
  - algorithms
topics:
  - blind-75
  - dynamic-programming
companies: []
language: java
starterCode: |
  class Solution {
      public int climbStairs(int n) {
          throw new UnsupportedOperationException("Not implemented");
      }
  }
---

## Description

A staircase has `n` steps. Starting below the first step, you may move up
either one or two steps at a time. Return the number of distinct sequences of
moves that land exactly on step `n`. Different orders of moves count separately.

### Examples

```text
Input: n = 1
Output: 1

Input: n = 3
Output: 3
Explanation: [1,1,1], [1,2], and [2,1].

Input: n = 5
Output: 8
```

### Constraints

- `1 <= n <= 45`.
- Moves must be positive and cannot overshoot the final step.
- The answer fits in a signed 32-bit integer for this range.

### Edge Cases

Consider the first two step counts, counting sequences rather than unordered
combinations, and the upper limit where repeated work becomes expensive.

## Discussion

Explain what your state represents and why it accounts for every valid move
sequence once. Discuss repeated work and how much earlier state you need to retain.

# Interviewer Context

Let the candidate derive the relationship between subproblems. Do not provide a recurrence or a Fibonacci implementation.

- Junior: correctly enumerate small inputs and distinguish ordered sequences from combinations.
- Middle: derive consistent base cases and a method efficient enough for `n = 45`.
- Senior: justify completeness of the counting argument and reduce unnecessary storage; discuss numeric limits if the range increases.
- Staff / Principal: explore a changed allowed-step set and reason about the resulting state and growth, rather than demanding a specialized formula.
- Ask for traces at `n = 1`, `2`, and `3`. The task may provide limited evidence for advanced competencies; do not manufacture it.
