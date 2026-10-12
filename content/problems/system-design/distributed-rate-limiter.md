---
id: distributed-rate-limiter
title: Design a Distributed Rate Limiter
interview: system-design
difficulty: medium
categories:
  - distributed-systems
  - backend
topics:
  - rate-limiting
  - consistency
  - availability
  - scalability
companies: [ ]
---

## Description

Design a shared rate-limiting service for a public API used by multiple tenants.
Requests can arrive at any API server. Enforce configurable limits without making
the limiter a major source of latency or outages. Clarify what a limit guarantees
and how the API should behave when the limiter is unavailable.

### Example

A tenant can make 100 requests per minute. An allowed request proceeds; a rejected
request receives a throttling response with useful retry information. Discuss
whether short bursts are acceptable rather than assuming a window policy.

## Functional Requirements

- Decide whether a request is allowed for a tenant and endpoint policy.
- Support tenant-level defaults and overrides, with policy updates.
- Return a rejection reason and retry guidance; expose usage for operations.
- Authentication supplies tenant identity; building authentication is out of scope.

## Non-Functional Requirements

- Target less than 5 ms added p99 latency within a region and 99.99% decision availability.
- Limit noisy tenants while keeping memory and infrastructure cost bounded.
- Clarify allowable overshoot, policy propagation delay, and failure behavior.

## Scale

Assume 100000 requests/second normally, 500000 at peak, 100000 active tenants,
and hundreds of API servers across three regions. A hot tenant may produce 10%
of traffic. These are planning assumptions, not mandatory deployment choices.

## Constraints

Limits must work across API instances. Client clocks and client-provided identities
are untrusted. Regional latency and partitions complicate globally strict limits.
Metering for billing is separate from approximate protection against overload.

## Discussion

Compare accuracy with latency and availability, centralized with partitioned
decision state, and isolation with utilization. Consider a hot key, a policy
update during a burst, clock skew, and loss of decision state after failover.

# Interviewer Context

Let the candidate clarify burst semantics, regional versus global scope, and
acceptable overshoot. Use the assumptions above when asked. Ask them to represent
decision state and request flow in their workspace; do not name a required algorithm
or storage product. Choose one or two deep dives from the proposed design.

- Middle: coherent decision API, policy/state model, request flow, and explicit unavailable-service behavior.
- Senior: reason about concurrent updates, hot tenants, failover resets, latency budgets, and measurable overshoot.
- Staff: compare regional and global enforcement and explain a safe rollout from existing local limits, including client
  compatibility and operational ownership.
- Principal: examine different guarantees for protection and contractual quotas, cross-region failure consequences, and
  how policy and cost evolve with tenant growth.

Useful deep dives are atomic decisions for one tenant or policy propagation under
load. Introduce a state-store failure or partition only when those components exist
in the candidate's diagram. Assess the chosen trade-offs; do not require every
advanced topic or revisit questions already answered. Follow the definition's
flow and duration, leaving time for an actual design and a concise conclusion.
