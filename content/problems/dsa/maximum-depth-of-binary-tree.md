---
id: maximum-depth-of-binary-tree
title: Maximum Depth of Binary Tree
interview: dsa
difficulty: easy
categories:
  - algorithms
topics:
  - blind-75
  - trees
  - depth-first-search
  - breadth-first-search
companies: []
language: java
starterCode: |
  class TreeNode {
      int val;
      TreeNode left;
      TreeNode right;
      TreeNode(int val) { this.val = val; }
  }

  class Solution {
      public int maxDepth(TreeNode root) {
          throw new UnsupportedOperationException("Not implemented");
      }
  }
---

## Description

Return the maximum number of nodes on a path from the root of a binary tree to
a leaf. A leaf has no children. The depth of an empty tree is `0`, and the
depth of a single-node tree is `1`.

### Examples

```text
Input: root = [4, 2, 8, null, null, 6, 9]
Output: 3

Input: root = [1, null, 2, null, 3]
Output: 3

Input: root = []
Output: 0
```

Tree examples use level-order serialization: `null` marks a missing child,
and trailing null entries are omitted. The function receives a root node.

### Constraints

- The tree contains between `0` and `10000` nodes, with no cycles or shared children.
- `-10000 <= node.val <= 10000`.
- Tree shape, not values, determines depth; the tree may be completely skewed.

### Edge Cases

Consider an empty tree, a single node, only one child per node, and different
depths in the left and right subtrees.

## Discussion

Explain how you measure depth and compare time and memory use for narrow,
deep trees and broad, shallow trees.

# Interviewer Context

Do not prescribe a recurrence or traversal implementation.

- Junior: correctly count nodes rather than edges and handle null children.
- Middle: visit the relevant nodes once and explain how the deepest path is selected.
- Senior: justify time and space in terms of height or width; recognize call-stack limits on a skewed tree.
- Staff / Principal: discuss robustness for very deep input and justify an iterative alternative if recursion is unsafe. Avoid unrelated distributed-tree requirements.
- Trace an uneven tree and account for traversal storage. This easy task alone may not expose advanced competency evidence.
