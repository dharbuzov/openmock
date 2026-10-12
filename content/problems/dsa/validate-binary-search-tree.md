---
id: validate-binary-search-tree
title: Validate Binary Search Tree
interview: dsa
difficulty: medium
categories:
  - algorithms
topics:
  - blind-75
  - trees
  - binary-search-trees
  - depth-first-search
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
      public boolean isValidBST(TreeNode root) {
          throw new UnsupportedOperationException("Not implemented");
      }
  }
---

## Description

Determine whether a binary tree is a valid binary search tree. For every node,
all values in its left subtree must be strictly smaller, and all values in its
right subtree must be strictly larger. These requirements apply throughout each
subtree, not just to immediate children. Duplicate values are invalid.

### Examples

```text
Input: root = [8, 4, 12, 2, 6, 10, 14]
Output: true

Input: root = [8, 4, 12, null, null, 6, 14]
Output: false
Explanation: 6 is in the right subtree of 8 but is smaller than 8.

Input: root = [2, 2, 3]
Output: false
```

Tree examples use level-order serialization; `null` marks a missing child.
The function receives a root node, not the serialized array.

### Constraints

- The tree contains between `1` and `10000` nodes, with no cycles or shared children.
- `-2^31 <= node.val <= 2^31 - 1`.
- The tree may be skewed; missing children are valid.

### Edge Cases

Consider a descendant violating an ancestor's ordering, duplicate values,
the minimum or maximum signed integer, and a single-node tree.

## Discussion

Explain how your validation captures ancestor relationships. Discuss the state
you retain and how numeric boundaries and tree depth affect your implementation.

# Interviewer Context

Do not provide bounds propagation or an ordered-traversal solution upfront.

- Junior: recognize the global subtree requirement and show why parent-child comparisons alone can fail.
- Middle: implement a correct linear-time validation that rejects duplicates and distant ordering violations.
- Senior: justify a global ordering invariant, handle the entire integer domain without sentinel errors, and account for skewed-tree storage.
- Staff / Principal: explore an altered duplicate policy or constrained traversal memory and defend the resulting semantics. Accept alternative methods with a sound proof.
- Trace the invalid descendant example and a single node holding the minimum integer. Assess correctness from actual code and reasoning.
