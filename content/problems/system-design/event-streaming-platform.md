---
id: event-streaming-platform
title: Design an Event Streaming Platform
interview: system-design
difficulty: hard
categories:
  - distributed-systems
  - backend
topics:
  - messaging
  - partitioning
  - replication
  - backpressure
companies: []
---

## Description

Design a shared platform where applications publish durable event streams and
independent consumers process or replay them. Define ordering, retention, and
recovery guarantees while keeping slow consumers from disrupting other tenants.
Design the platform boundaries; naming an existing broker alone is insufficient.

### Example

An order service publishes events keyed by order ID. Analytics and fulfillment
consume independently. Analytics pauses for an hour and later catches up; a
fulfillment worker crashes after performing an action but before saving its progress.

## Functional Requirements

- Create streams, publish events, subscribe, and track independent consumer progress.
- Support keyed ordering, retention policies, and replay within retained history.
- Manage consumer membership, access permissions, and tenant quotas.
- Expose lag and operational status; stream joins and a SQL processing engine are out of scope.

## Non-Functional Requirements

- Target 99.95% publish/read availability and less than 50 ms p99 publish acknowledgment within a region.
- Clearly define when an accepted event is durable and what ordering scope is guaranteed.
- Isolate tenants, bound resource use, and apply backpressure under overload.
- Recover from a storage-node loss and identify guarantees that weaken during partitions.

## Scale

Assume 1 million events/second, averaging 1 KB each, across 10000 streams.
Default retention is 24 hours: roughly 86 TB/day before replication and overhead.
Some streams retain 7 days, keys can be skewed, and several consumer groups read
each stream. Estimate both storage and repeated read bandwidth.

## Constraints

Consumers can replay and repeat external side effects. Producer retries may duplicate
events unless the proposed contract addresses them. Strict global order is not a
default requirement. Consumer progress can fall behind retention; agree on the
result. Built or purchased storage is acceptable if its guarantees are justified.

## Discussion

Compare ordering with parallelism, acknowledgment latency with durability, and
retention with cost. Consider a hot key, leader/storage failure, consumer membership
changes, a slow consumer, or exhaustion of disk capacity during a traffic surge.

# Interviewer Context

Clarify keyed ordering, retention, acknowledgment, and replay semantics. Encourage
a diagram that traces publication, durable storage, consumption, and progress.
Do not prescribe a log layout, consensus implementation, or broker product.

- Middle: coherent stream/event/progress model, producer and consumer APIs, basic durable storage, and independent consumer flows.
- Senior: justify partitioning, replication acknowledgment, retry identity, consumer recovery, hot-key limits, and backpressure with measurable costs.
- Staff: compare storage/compute and partitioning alternatives; plan rebalancing or format migration with producer and consumer compatibility and operational ownership.
- Principal: reason about multi-region recovery, evolving delivery contracts, retention economics, and ecosystem-wide migration risk without requiring a complete commercial broker implementation.

Choose one substantial deep dive, such as durability across failover or consumer
progress during reassignment. Failures should affect components actually proposed.
Distinguish platform guarantees from exactly-once external actions. Do not require
all advanced topics or repeat previously established ordering arguments; preserve
the definition's flow and time for a design summary.
