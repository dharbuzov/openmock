---
id: contains-duplicate
title: Contains Duplicate
interview: dsa
difficulty: easy
categories:
  - algorithms
topics:
  - blind-75
  - arrays
  - hash-maps
companies: []
language: java
starterCode: |
  class Solution {
      public boolean containsDuplicate(int[] nums) {
          throw new UnsupportedOperationException("Not implemented");
      }
  }
---

## Description

Given an integer array `nums`, return `true` if any value occurs more than once.
Return `false` when all values are distinct.

### Examples

```text
Input: nums = [4, 9, 2, 4]
Output: true

Input: nums = [-2, 0, 7]
Output: false

Input: nums = [5]
Output: false
```

### Constraints

- `1 <= nums.length <= 100000`.
- `-10^9 <= nums[i] <= 10^9`.
- Input order has no significance. State whether your approach modifies the input.

### Edge Cases

Consider adjacent and distant duplicates, repeated negative values, all-equal
values, and a single element.

## Discussion

Explain how you detect repetition, the cost of storing seen values, and the
trade-off if the caller requires the input array to remain unchanged.

# Interviewer Context

Assess the candidate's own approach; do not prescribe a data structure or reveal an implementation.

- Junior: implement a correct check and explain how a repeated value is recognized.
- Middle: justify time and space costs and handle repetition anywhere in the array.
- Senior: compare alternatives under mutation and memory constraints; distinguish average and worst-case costs.
- Staff / Principal: explore a changed requirement such as a stream or bounded value range, based on the candidate's reasoning. Assess limits and trade-offs without demanding unrelated complexity.
- Ask for a manual trace containing a late duplicate. Rate only evidence observed; this easy problem alone may not provide an opportunity to assess advanced competencies.
