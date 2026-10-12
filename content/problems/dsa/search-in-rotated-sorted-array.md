---
id: search-in-rotated-sorted-array
title: Search in Rotated Sorted Array
interview: dsa
difficulty: medium
categories:
  - algorithms
topics:
  - blind-75
  - arrays
  - binary-search
companies: []
language: java
starterCode: |
  class Solution {
      public int search(int[] nums, int target) {
          throw new UnsupportedOperationException("Not implemented");
      }
  }
---

## Description

An ascending array of distinct integers has been rotated by an unknown number
of positions, possibly zero. Return the index of `target` in the given array,
or `-1` if it is absent. Your search must run in `O(log n)` time.

### Examples

```text
Input: nums = [8, 11, 15, 1, 3, 5], target = 3
Output: 4

Input: nums = [8, 11, 15, 1, 3, 5], target = 7
Output: -1

Input: nums = [1, 3, 5], target = 1
Output: 0
```

### Constraints

- `1 <= nums.length <= 5000`.
- `-10000 <= nums[i], target <= 10000`.
- All array values are distinct; the input is a rotation of a strictly ascending array.
- Do not sort the array, because the requested index refers to its current order.

### Edge Cases

Consider one or two elements, no rotation, the target at a boundary, and the
target on either side of the rotation point.

## Discussion

Explain what can be inferred about the remaining search region and justify why
each reduction retains a possible target and makes progress.

# Interviewer Context

Do not reveal interval-selection rules or require a particular implementation.

- Junior: demonstrate correct indexing and explain why a normal sorted-array search needs adaptation.
- Middle: achieve logarithmic time under the distinct-value guarantee with correct absent-target behavior.
- Senior: state a search invariant, justify each discarded region, and trace difficult two-element boundaries.
- Staff / Principal: discuss whether logarithmic worst-case behavior survives a changed duplicate-value requirement, grounding the answer in ambiguity of comparisons.
- Probe termination and off-by-one behavior. Accept direct search or a separately justified pivot-based approach.
