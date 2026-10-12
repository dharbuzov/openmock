---
id: three-sum
title: 3Sum
interview: dsa
difficulty: medium
categories:
  - algorithms
topics:
  - blind-75
  - arrays
  - two-pointers
  - sorting
companies: []
language: java
starterCode: |
  import java.util.List;

  class Solution {
      public List<List<Integer>> threeSum(int[] nums) {
          throw new UnsupportedOperationException("Not implemented");
      }
  }
---

## Description

Return every distinct triplet of values from `nums` whose sum is zero. The three
values must come from different indices. Return each value combination only once,
even if several index combinations produce it. The order of triplets and the
order within each triplet do not matter.

### Examples

```text
Input: nums = [-2, 0, 1, 1, 2]
Output: [[-2, 0, 2], [-2, 1, 1]]

Input: nums = [0, 0, 0, 0]
Output: [[0, 0, 0]]

Input: nums = [1, 2, 4]
Output: []
```

### Constraints

- `3 <= nums.length <= 3000`.
- `-100000 <= nums[i] <= 100000`.
- Duplicate input values are allowed. State whether you modify the input.

### Edge Cases

Consider repeated values needed in a valid triplet, all zeros, no result,
all-positive or all-negative inputs, and many equivalent index combinations.

## Discussion

Explain how you avoid repeated results without dropping valid combinations.
Separate working memory from the memory needed to return the answer.

# Interviewer Context

Let the candidate choose and defend an approach. Do not supply a sorting or pointer recipe.

- Junior: identify the difference between distinct indices and distinct output values; a correct baseline is useful evidence even if too slow.
- Middle: produce an approach suitable for the input bound and correctly suppress duplicate triplets.
- Senior: justify quadratic-time search or an equally defensible alternative, its completeness, and any mutation and output-space costs.
- Staff / Principal: discuss how guarantees change for larger numeric ranges or output-heavy inputs; assess rigorous limits rather than demanding a novel algorithm.
- Trace both `[-2, 1, 1]` and repeated zeros. Ask why no combination is missed and why a repeated combination is not emitted.
