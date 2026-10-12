---
id: linked-list-cycle
title: Linked List Cycle
interview: dsa
difficulty: easy
categories:
  - algorithms
topics:
  - blind-75
  - linked-lists
  - two-pointers
companies: []
language: java
starterCode: |
  class ListNode {
      int val;
      ListNode next;
      ListNode(int val) { this.val = val; }
  }

  class Solution {
      public boolean hasCycle(ListNode head) {
          throw new UnsupportedOperationException("Not implemented");
      }
  }
---

## Description

Determine whether following `next` references from `head` can revisit the same
node. Return `true` for a cycle and `false` when traversal eventually reaches
`null`. Do not modify the list.

### Examples

```text
Input: values = [7, 2, 5], tail links to node at index 1
Output: true

Input: values = [7, 7], tail links to null
Output: false

Input: values = [4], tail links to node at index 0
Output: true

Input: values = [], head = null
Output: false
```

The tail-link description specifies how the example list is constructed. It is
not an argument to `hasCycle`; the function receives only the head reference.

### Constraints

- The list contains between `0` and `10000` distinct node objects.
- `-100000 <= node.val <= 100000`; values may repeat.
- A node's `next` is another node or `null`. Compare node identity, not values.

### Edge Cases

Consider a self-cycle, a cycle beginning at the head, a long prefix before a
cycle, and repeated values in an acyclic list.

## Discussion

Explain why your detection terminates for both cyclic and acyclic inputs.
Discuss whether you can meet an `O(1)` auxiliary-space follow-up requirement.

# Interviewer Context

Do not provide pointer speeds or a meeting argument before the candidate proposes an approach.

- Junior: identify repeated node identity correctly and avoid an unbounded traversal.
- Middle: implement reliable cycle detection and explain time and memory costs, including null checks.
- Senior: address the constant-space follow-up and justify termination and detection rather than citing a memorized technique.
- Staff / Principal: reason about the prefix and cycle lengths or a cycle-entry follow-up if sufficient time remains. Assess proof and limits rather than requiring an extra feature.
- Trace a self-cycle and an acyclic list with equal values. Record limited advanced assessment opportunities honestly.
