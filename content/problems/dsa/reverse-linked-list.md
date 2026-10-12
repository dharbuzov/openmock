---
id: reverse-linked-list
title: Reverse Linked List
interview: dsa
difficulty: easy
categories:
  - algorithms
topics:
  - blind-75
  - linked-lists
companies: []
language: java
starterCode: |
  class ListNode {
      int val;
      ListNode next;
      ListNode(int val) { this.val = val; }
  }

  class Solution {
      public ListNode reverseList(ListNode head) {
          throw new UnsupportedOperationException("Not implemented");
      }
  }
---

## Description

Reverse an acyclic singly linked list and return its new head. Reuse the
existing nodes by changing links; do not construct a replacement list.
An empty list is represented by `null`.

### Examples

```text
Input: head = [2, 4, 6]
Output: [6, 4, 2]

Input: head = [9]
Output: [9]

Input: head = []
Output: []
```

Array notation describes values in traversal order, not an array input.

### Constraints

- The list contains between `0` and `5000` nodes and has no cycle.
- `-5000 <= node.val <= 5000`.
- Node values may repeat; node identity and links matter.

### Edge Cases

Consider an empty list, one or two nodes, repeated values, and ensuring the old
head becomes the final node with `next == null`.

## Discussion

Explain how you retain access to nodes whose links are being changed and how
you show that the result contains every original node exactly once.

# Interviewer Context

Do not supply the sequence of pointer updates or a full recursive solution.

- Junior: produce a correct reversal, including empty and single-node inputs, and reason about references rather than values alone.
- Middle: safely reuse nodes in linear time and trace pointer changes without losing the remaining list.
- Senior: justify a loop or recursion invariant and discuss auxiliary space, including call-stack use.
- Staff / Principal: explore ownership and aliasing if another caller holds a node reference, or stack-depth limits for larger lists. Keep follow-ups tied to the actual implementation.
- Ask the candidate to trace a three-node list and verify that no accidental cycle remains. Avoid inferring advanced competency from this small task alone.
