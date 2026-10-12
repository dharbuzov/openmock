---
id: distributed-job-scheduler
title: Design a Distributed Job Scheduler
interview: system-design
difficulty: hard
categories:
  - distributed-systems
  - backend
topics:
  - scheduling
  - asynchronous-processing
  - idempotency
  - availability
companies: []
---

## Description

Design a service that schedules one-time and recurring jobs for multiple tenants
and dispatches them to workers. Jobs may run for seconds or hours. Make execution
and recovery guarantees explicit when a worker fails or becomes unreachable.

### Example

A tenant schedules a daily report. A worker starts it but loses contact before
reporting completion. The service must decide whether to wait, retry, or report an
uncertain outcome without assuming that the report's side effect did not happen.

## Functional Requirements

- Create, inspect, update, and cancel one-time or recurring schedules.
- Dispatch eligible runs, track attempts and outcomes, and apply bounded retry policies.
- Provide tenant concurrency limits, basic priorities, and execution history.
- Assume workers execute registered job types; arbitrary code hosting and dependency DAGs are optional extensions.

## Non-Functional Requirements

- Target 99.9% scheduling API availability and normal start delay below 10 seconds for short jobs.
- Accepted schedules must survive a scheduler-process loss.
- Isolate tenants and avoid unbounded retry storms or starvation.
- Distinguish dispatch, execution, and business-side-effect guarantees; define outage catch-up behavior.

## Scale

Assume 10 million active schedules and 1 million runs/hour, with bursts of
50000 due runs/second at popular clock boundaries. Jobs range from 1 second
to 2 hours across 10000 worker slots. Discuss admission control when due work
exceeds capacity rather than promising every job starts simultaneously.

## Constraints

Workers may pause and resume after losing their assignment. Cancellation races
with execution, and side effects may not be reversible. Recurring schedules need
explicit time-zone, daylight-saving, missed-run, and overlap semantics. Clock
skew exists; clients cannot establish authoritative completion just by timing out.

## Discussion

Compare scheduling precision with throughput, retries with duplicate side effects,
and fairness with utilization. Consider scheduler failover, a partitioned worker,
an overload burst, or a recurring job that consistently runs longer than its interval.

# Interviewer Context

Let the candidate agree on job contracts and recurrence semantics. Encourage a
workspace diagram of schedule discovery, dispatch, execution, and recovery.
Do not prescribe leases, a coordination product, or a queue topology.

- Middle: coherent schedule/run/attempt data, control APIs, worker flow, and bounded retries with basic tenant limits.
- Senior: reason about assignment ownership, stale workers, retries after uncertainty, cancellation, clock boundaries, and capacity under bursty due work.
- Staff: compare scheduling partitions and executor boundaries; explain safe repartitioning or recurrence-policy migration with run identity preserved.
- Principal: examine business-side-effect contracts, ownership across tenant teams, capacity economics, and operational recovery commitments without requiring all workflow-engine features.

Deep dives can examine an old worker resuming after reassignment or recovery of
missed recurring runs. Tie failures to the diagram. Do not accept exactly-once
side effects merely because a queue claims delivery guarantees. Assess the chosen
scope within the duration and avoid repetitive questions about the same race.
