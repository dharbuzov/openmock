---
id: number-of-islands
title: Number of Islands
interview: dsa
difficulty: medium
categories:
  - algorithms
topics:
  - blind-75
  - graphs
  - depth-first-search
  - breadth-first-search
  - matrices
companies: []
language: java
starterCode: |
  class Solution {
      public int numIslands(char[][] grid) {
          throw new UnsupportedOperationException("Not implemented");
      }
  }
---

## Description

Count the islands in a rectangular grid. A cell containing `'1'` is land and
a cell containing `'0'` is water. An island is a maximal group of land cells
connected horizontally or vertically. Diagonal contact does not connect islands.
Cells outside the grid are water.

### Examples

```text
Input: grid = [["1","1","0"],
               ["0","1","0"],
               ["1","0","1"]]
Output: 3

Input: grid = [["1","0"], ["0","1"]]
Output: 2

Input: grid = [["0","0","0"]]
Output: 0
```

### Constraints

- `1 <= grid.length, grid[0].length <= 300`.
- Every row has the same length; each cell is `'0'` or `'1'`.
- You may modify the grid, but disclose that choice. Explain the space cost if
  the caller instead needs its input preserved.

### Edge Cases

Consider all land, all water, a single row or column, diagonal-only contact,
and an island touching every boundary.

## Discussion

Explain how you distinguish a newly discovered island from land already
accounted for, and how you avoid counting one connected group more than once.

# Interviewer Context

Do not supply traversal directions, visited-state code, or a full flood-fill solution.

- Junior: apply four-way connectivity and demonstrate a correct approach on disconnected groups.
- Middle: count each component once with a traversal that terminates, including boundary checks.
- Senior: justify `O(rows * columns)` work and worst-case auxiliary space; address mutation and recursion-depth risks on large connected grids.
- Staff / Principal: explore changed adjacency or incremental cell updates and discuss whether the current approach remains suitable, without requiring a new feature.
- Trace the diagonal example and an all-land grid. Assess marking discipline and progress from the candidate's actual implementation.
