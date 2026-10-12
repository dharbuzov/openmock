---
id: top-k-frequent-elements
title: Top K Frequent Elements
interview: dsa
difficulty: medium
categories:
  - algorithms
topics:
  - blind-75
  - arrays
  - hash-maps
  - heaps
  - bucket-sort
companies: []
language: java
starterCode: |
  class Solution {
      public int[] topKFrequent(int[] nums, int k) {
          throw new UnsupportedOperationException("Not implemented");
      }
  }
---

## Description

Return the `k` distinct values that occur most frequently in `nums`. Output
order does not matter. The input guarantees a unique set of `k` most frequent
values: when `k` is smaller than the number of distinct values, there is no tie
across the selection boundary. Ties within the selected set are allowed.

### Examples

```text
Input: nums = [4, 4, 4, 2, 2, 9], k = 2
Output: [4, 2]

Input: nums = [-1, -1, 3, 3], k = 2
Output: [-1, 3]

Input: nums = [7], k = 1
Output: [7]
```

### Constraints

- `1 <= nums.length <= 100000`.
- `-10000 <= nums[i] <= 10000`.
- `1 <= k <=` the number of distinct values in `nums`.
- Return values, not frequencies or repeated copies of the same value.

### Edge Cases

Consider one distinct value, negative values, equal frequencies within the
answer, and `k` equal to the number of distinct values.

## Discussion

Explain how you separate counting from selection. Compare time and space costs
when `k` is small versus large, and discuss a follow-up seeking better than
`O(n log n)` time without sorting the full input.

# Interviewer Context

Do not name a preferred selection recipe or supply its implementation.

- Junior: count values correctly and distinguish frequency ranking from numeric ordering.
- Middle: produce the correct selected set and explain cost in terms of input length, distinct values, and `k`.
- Senior: address the efficiency follow-up with a justified approach; distinguish bounds and trade-offs for different input shapes.
- Staff / Principal: discuss loss of the unique-boundary guarantee or an incremental input requirement, including what changes in semantics or storage. Do not require streaming code unless agreed as a follow-up.
- Accept any valid output order. Probe equal selected frequencies and the all-distinct, all-selected case.
