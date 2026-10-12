---
id: two-sum
title: Two Sum
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
      public int[] twoSum(int[] nums, int target) {
          // Write your solution here.
          throw new UnsupportedOperationException("Not implemented");
      }
  }
---

## Description

Given an array of integers `nums` and an integer `target`, return the
indices of the two numbers such that they add up to `target`.

You may assume that each input has exactly one solution, and you may not
use the same element twice.

You can return the answer in any order.

### Example

``` text
Input:
nums = [2, 7, 11, 15]
target = 9

Output:
[0, 1]
```

Because:

``` text
nums[0] + nums[1] = 2 + 7 = 9
```

### Constraints

-   `2 <= nums.length <= 10^4`
-   `-10^9 <= nums[i] <= 10^9`
-   `-10^9 <= target <= 10^9`
-   Exactly one valid answer exists

### Additional Examples

```text
Input: nums = [3, 3], target = 6
Output: [0, 1]

Input: nums = [-4, 7, 2], target = -2
Output: [0, 2]
```

### Edge Cases

Consider equal values at different indices, negative numbers, a zero target,
and an answer involving the first or last element. There is exactly one answer;
you do not need to define behavior for inputs with no valid pair.

## Discussion

Be prepared to explain:

- Your initial approach
- Time complexity
- Space complexity
- How you can improve a brute-force solution
- Edge cases

# Interviewer Context

Do not provide a lookup recipe or a complete implementation. Assess the
candidate's approach against the exactly-one-answer guarantee.

- Junior: return indices rather than values and never use the same index twice.
- Middle: implement an efficient approach, including equal values at different indices and negative numbers.
- Senior: justify the search invariant and time and space trade-offs; preserve original indices when discussing alternatives that reorder values.
- Staff / Principal: explore altered assumptions such as multiple valid pairs or a stream, and assess what changes in the contract and retained state. Do not demand unrelated sophistication from this easy problem.
- Ask for a trace on `[3, 3]` with target `6`, and discuss arithmetic safety under the stated bounds. Record advanced competencies as unassessed when no meaningful opportunity arises.
