---
id: notification-system
title: Design a Notification System
interview: system-design
difficulty: medium
categories:
  - distributed-systems
  - backend
topics:
  - messaging
  - asynchronous-processing
  - idempotency
  - availability
companies: []
---

## Description

Design a service that sends email, SMS, and push notifications for several product
teams. Support transactional messages and scheduled notifications while respecting
user preferences. Clarify what it means for a notification to be accepted, sent,
and delivered when external providers control the final delivery.

### Example

An order service submits a shipment notification with a stable request ID. The
notification service selects permitted channels and reports progress. Resubmitting
the request after a timeout should not unintentionally send the user a second message.

## Functional Requirements

- Accept notification requests with recipient, template, parameters, priority, and optional schedule.
- Apply channel preferences, unsubscribe decisions, and channel-specific rules.
- Track status and retry eligible failures; ingest provider callbacks.
- Support templates and operational inspection of failures. A visual campaign editor is out of scope.

## Non-Functional Requirements

- Target 99.9% intake availability; urgent requests normally begin dispatch within 5 seconds.
- Durable acceptance must survive process failure. Bulk work must not starve urgent messages.
- Protect recipient data and expose latency, failure, and backlog metrics.
- Distinguish provider acceptance from confirmed delivery; no unconditional end-to-end exactly-once promise.

## Scale

Assume 20 million requests/day, bursts of 10000/second, and 50 million user
preference records. Provider quotas vary by channel and region. A campaign can
generate several million requests within a few minutes.

## Constraints

Providers may time out after accepting a send, callbacks can repeat or arrive
out of order, and SMS has a meaningful per-message cost. Preference changes near
dispatch require an explicit policy. Assume payment alerts and marketing messages
have different urgency; let the candidate negotiate scope and retention.

## Discussion

Consider retry versus duplicate delivery, preference freshness versus throughput,
provider fallback versus extra cost, and priority fairness. Explore a provider
outage, a growing backlog, or a duplicated callback tied to the chosen design.

# Interviewer Context

Clarify channel scope, acceptance semantics, and preference checks before expanding
features. Encourage a workspace diagram covering submission, dispatch, and status.
Do not prescribe a broker, deduplication store, or provider strategy.

- Middle: define APIs, notification/status data, a complete dispatch flow, and basic retries with user preferences.
- Senior: handle ambiguous send outcomes, throttling, backlog isolation, callback ordering, and observability with defensible reliability guarantees.
- Staff: compare shared and channel-specific pipelines, plan provider or template migrations, and define ownership and safe rollout across product teams.
- Principal: reason about policy consistency across channels, provider concentration risk, retention boundaries, and long-term cost without treating all notifications alike.

Deep-dive opportunities include duplicate suppression or urgent traffic during a
campaign. Select one based on the candidate's architecture. Do not invent components
or demand certainty about external delivery. Avoid repeated reliability questions;
evaluate evidence within the configured duration rather than a checklist of features.
