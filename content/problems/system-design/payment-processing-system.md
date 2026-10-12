---
id: payment-processing-system
title: Design a Payment Processing System
interview: system-design
difficulty: hard
categories:
  - distributed-systems
  - backend
topics:
  - payments
  - idempotency
  - consistency
  - reconciliation
companies: []
---

## Description

Design a merchant-facing service that accepts payment requests, interacts with
an external payment processor, and exposes reliable payment status and refunds.
Focus on preventing unintended duplicate charges and recovering from uncertain
outcomes. Clarify which financial operations belong to your service.

### Example

A merchant submits a payment, times out, and retries the same request. The
processor may already have charged the customer. The merchant needs a stable
payment identity and a way to learn the outcome without creating another charge.

## Functional Requirements

- Create payments with amount, currency, merchant identity, and an idempotency key.
- Query status, process provider callbacks, and request full or partial refunds.
- Record auditable state changes and reconcile local records against provider outcomes.
- Use provider-issued payment-method tokens; building a card vault, lending, and fraud models is out of scope.

## Non-Functional Requirements

- Target 99.95% intake/status availability and less than 200 ms p99 local processing overhead, excluding provider latency.
- Never report success without supporting evidence; ambiguous provider outcomes must be represented explicitly.
- Preserve durable financial records, restrict access, and make operational corrections auditable.
- Prefer accurate outcomes over an unconditional promise that every request completes immediately.

## Scale

Assume 10 million payment attempts/day, 5000/second at peak, 100000 merchants,
and several processors with different status and retry contracts. Keep currencies
explicit and represent amounts in integer minor units with currency-specific rules.

## Constraints

Local storage and external processors cannot be assumed to share a transaction.
Callbacks can arrive late, repeat, or contradict an earlier provisional result.
Provider idempotency may have a retention limit. Do not assume rerouting an
uncertain request to another provider is safe. State the scope of the local ledger.

## Discussion

Compare synchronous outcomes with deferred resolution, retry availability with
duplicate-charge risk, and local bookkeeping with provider truth. Consider a timeout
after an external charge, a repeated refund request, or a reconciliation discrepancy.

# Interviewer Context

Use a simulated processor contract, not memorized vendor behavior. Let the candidate
clarify authorization/capture scope and the meaning of success. Ask for a diagram
of payment submission, uncertain outcomes, and recovery. Do not provide a state
machine, transaction pattern, or ledger architecture upfront.

- Middle: clear APIs, stable identities, payment/refund records, and explicit pending, successful, and failed outcomes with safe basic retries.
- Senior: justify idempotency boundaries, legal state changes, concurrency, durable evidence, callback handling, and reconciliation after ambiguous outcomes.
- Staff: compare processor integration boundaries, design a reversible processor or schema migration, and define exception-handling ownership across engineering and operations.
- Principal: reason about cross-system financial truth, concentration risk, auditability, and operational controls as the business expands; do not demand a full banking platform.

Deep-dive opportunities include concurrent retries or partial refunds during delayed
callbacks. Select one from the proposed architecture and inject a relevant failure.
No single storage or messaging choice is required. Assess correctness and explicit
limitations without requiring all advanced topics or repeating already-covered risks.
