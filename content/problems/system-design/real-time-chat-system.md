---
id: real-time-chat-system
title: Design a Real-Time Chat System
interview: system-design
difficulty: medium
categories:
  - distributed-systems
  - backend
topics:
  - messaging
  - real-time-systems
  - ordering
  - data-modeling
companies: []
---

## Description

Design a chat service with direct conversations and small groups. Users should
exchange messages in real time when online and recover missed messages after
reconnecting. Clarify the meaning of sent, delivered, and read, including when
one user connects from several devices.

### Example

Alice sends a message to a group while Bob is offline. Bob reconnects later and
receives the missed messages. Alice retries a send after losing her connection;
the conversation should not show an unintended duplicate.

## Functional Requirements

- Send and retrieve text messages for authorized conversation members.
- Maintain conversation history and support reconnect catch-up.
- Support group membership and delivery acknowledgments; negotiate read receipts and presence as extensions.
- Media calls, public channels, and full-text search are outside the initial scope.

## Non-Functional Requirements

- Target 99.95% messaging availability and less than 300 ms p99 online delivery within a region.
- Acknowledged durable messages should survive a single-server loss.
- Clarify ordering scope, offline retention, and behavior during a regional disruption.
- Enforce membership checks and protect private conversation content.

## Scale

Assume 10 million daily active users, 1 million simultaneous connections,
100 million messages/day, and 50000 messages/second at peak. Groups initially
have at most 100 members; users may have three active devices.

## Constraints

Networks are unreliable and clients can resend, reconnect, or be several versions
behind. A user's devices can observe different connectivity. Membership changes
can race with message delivery. Do not assume global ordering between unrelated chats.

## Discussion

Compare delivery latency with persistence guarantees, ordering with availability,
and per-recipient delivery work with catch-up cost. Consider reconnect storms,
connection-server loss, duplicate sends, or a removed member receiving late traffic.

# Interviewer Context

Use the workload as a starting point and let the candidate narrow receipts and
presence scope. Request a diagram of online delivery and offline recovery rather
than a theoretical comparison of protocols. Do not prescribe connection routing
or message storage. Choose a deep dive from the candidate's actual design.

- Middle: coherent messaging/history APIs, conversation and membership data, online and offline flows, and basic reconnect behavior.
- Senior: justify acknowledgment boundaries, conversation ordering, retry identity, device synchronization, and recovery under peak connection churn.
- Staff: compare routing and partitioning alternatives and plan protocol or storage migrations with mixed client versions and clear service ownership.
- Principal: address cross-region guarantees, privacy and retention boundaries, and evolving group size without demanding globally ordered delivery.

Useful deep dives are the retry-and-reconnect sequence or membership authorization
during fan-out. Introduce only failures relevant to the diagram. Do not demand every
optional capability; avoid repeating consistency questions once evidence is clear,
and preserve time for the definition's remaining flow.
