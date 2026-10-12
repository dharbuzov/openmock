---
id: longest-substring-without-repeating-characters
title: Longest Substring Without Repeating Characters
interview: dsa
difficulty: medium
categories:
  - algorithms
topics:
  - blind-75
  - strings
  - sliding-window
  - hash-maps
companies: []
language: java
starterCode: |
  class Solution {
      public int lengthOfLongestSubstring(String s) {
          throw new UnsupportedOperationException("Not implemented");
      }
  }
---

## Description

Return the length of the longest contiguous substring of `s` containing no
repeated character. A substring must be contiguous; a subsequence does not qualify.
Every character, including whitespace and punctuation, counts.

### Examples

```text
Input: s = "abcaef"
Output: 5
Explanation: "bcaef" is a longest valid substring.

Input: s = "abba"
Output: 2

Input: s = ""
Output: 0
```

### Constraints

- `0 <= s.length <= 50000`.
- Characters are ASCII letters, digits, punctuation, or spaces.
- Return a length, not the substring itself.

### Edge Cases

Consider all-identical characters, all-distinct characters, a duplicate outside
the current candidate substring, and repeated spaces.

## Discussion

Explain what makes the current candidate substring valid, how it changes after
a repetition, and why maintaining it does not require restarting the whole search.

# Interviewer Context

Do not give the candidate a window-update formula or a finished algorithm.

- Junior: distinguish substring from subsequence and demonstrate a correct baseline on repeated characters.
- Middle: implement a linear-time approach with consistent state for the currently considered range.
- Senior: justify the range invariant and amortized cost; explain why a previously seen character outside that range does not invalidate it.
- Staff / Principal: probe a stream or a changed character domain and assess what state is necessary, based on demonstrated reasoning.
- Ask for a manual trace of `abba` and repeated spaces. Look for monotonic progress and correct updates of the best length.
