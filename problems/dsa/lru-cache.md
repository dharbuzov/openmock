---
id: lru-cache
title: LRU Cache
type: dsa
level: medium
tags:
  - hash-map
  - linked-list
---

# LRU Cache

Design a cache with a fixed positive capacity that evicts the least recently used item when full.

## Requirements

- `get(key)` returns the value if present, or `-1` otherwise.
- `put(key, value)` inserts or updates a value.
- Reading or writing a key makes it the most recently used item.
- Both operations should run in O(1) average time.

## Example

With capacity 2, insert (1, 10) and (2, 20). Reading key 1 returns 10.
Inserting (3, 30) then evicts key 2, so reading key 2 returns -1.

## Constraints

- Capacity is between 1 and 3,000.
- Keys and values are non-negative integers.
- At most 200,000 operations are performed.

## Discussion

Explain your data structures, how you track usage, and how you handle updates to existing keys.
