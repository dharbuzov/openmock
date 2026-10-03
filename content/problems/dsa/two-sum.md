---
id: two-sum
difficulty: easy
categories:
- algorithms
topics:
- arrays
- hash-maps
companies: []
title: Two Sum
interview: dsa
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

## Discussion

Be prepared to explain:

-   Your initial approach
-   Time complexity
-   Space complexity
-   How you can improve a brute-force solution
-   Edge cases
