---
id: coin-change
title: Coin Change
interview: dsa
difficulty: medium
categories:
  - algorithms
topics:
  - blind-75
  - dynamic-programming
  - arrays
companies: []
language: java
starterCode: |
  class Solution {
      public int coinChange(int[] coins, int amount) {
          throw new UnsupportedOperationException("Not implemented");
      }
  }
---

## Description

Given distinct positive coin denominations and a target `amount`, return the
fewest coins whose values sum to that amount. You have an unlimited supply of
each denomination. Return `-1` if the amount cannot be formed, and `0` if the
amount is zero. You are minimizing a count, not counting different combinations.

### Examples

```text
Input: coins = [1, 3, 4], amount = 6
Output: 2
Explanation: Two coins of value 3 form 6.

Input: coins = [4, 6], amount = 7
Output: -1

Input: coins = [2, 5], amount = 0
Output: 0
```

### Constraints

- `1 <= coins.length <= 12`; denominations are distinct.
- `1 <= coins[i] <= 2^31 - 1`.
- `0 <= amount <= 10000`.
- Denominations may arrive in any order and may exceed the target amount.

### Edge Cases

Consider zero amount, no denomination small enough, unreachable amounts,
and a case where always taking the largest usable coin is suboptimal.

## Discussion

Explain how you represent impossible amounts and justify choosing the minimum
count. Discuss why an approach works for arbitrary denominations rather than
only familiar currency systems.

# Interviewer Context

Do not supply a recurrence, table initialization, or a complete solution.

- Junior: interpret unlimited reuse and minimization correctly; identify the need to distinguish unreachable states.
- Middle: implement an approach suitable for the bounds with correct zero and impossible results.
- Senior: justify optimality, state transitions, and time and space costs; avoid overflow or false minima when using unreachable-state markers.
- Staff / Principal: discuss scaling when the target is much larger or coin supplies become bounded, focusing on assumptions and limits without implementing an unrelated variant.
- Trace `[1, 3, 4]` with amount `6` and an unreachable input. Compare a candidate's greedy proposal against its own counterexample rather than revealing the expected algorithm.
