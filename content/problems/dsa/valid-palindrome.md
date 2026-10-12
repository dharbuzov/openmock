---
id: valid-palindrome
title: Valid Palindrome
interview: dsa
difficulty: easy
categories:
  - algorithms
topics:
  - blind-75
  - strings
  - two-pointers
companies: []
language: java
starterCode: |
  class Solution {
      public boolean isPalindrome(String s) {
          throw new UnsupportedOperationException("Not implemented");
      }
  }
---

## Description

Determine whether a string reads the same forward and backward after ignoring
non-alphanumeric characters and letter case. For this problem, alphanumeric
means ASCII letters `A-Z`, `a-z`, and digits `0-9`.
A string with no remaining characters is a palindrome.

### Examples

```text
Input: s = "No 'x' in Nixon"
Output: true

Input: s = "ab, ca"
Output: false

Input: s = " !!! "
Output: true
```

### Constraints

- `1 <= s.length <= 200000`.
- `s` contains printable ASCII characters only.
- Digits are significant and must be compared as characters.

### Edge Cases

Consider punctuation at either end, mixed case, a single meaningful character,
all punctuation, and a mismatch involving a digit.

## Discussion

Explain how character normalization affects correctness and memory use. State
what remains true while you compare the string and why the comparison terminates.

# Interviewer Context

Do not supply pointer movement rules or a complete solution.

- Junior: correctly normalize the specified character set and recognize mismatches.
- Middle: implement linear-time checking and explain boundary behavior without accessing outside the string.
- Senior: justify auxiliary space and a comparison invariant; discuss the distinction between ASCII and a changed Unicode requirement.
- Staff / Principal: probe specification ambiguity and limits of extending normalization, using the candidate's proposal. Do not turn the exercise into a Unicode trivia test.
- Request a manual trace with punctuation on both sides. Record missing assessment opportunities rather than assuming seniority from a memorized pattern.
