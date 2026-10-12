---
id: web-crawler
title: Design a Web Crawler
interview: system-design
difficulty: medium
categories:
  - distributed-systems
  - backend
topics:
  - scheduling
  - deduplication
  - backpressure
  - scalability
companies: []
---

## Description

Design a crawler that discovers public web pages, fetches their content, and
periodically revisits useful pages. It should use resources efficiently while
respecting site-specific access rules and avoiding excessive traffic to any host.

### Example

A fetched page links to several URLs, including an already discovered page and
a redirect. The crawler decides which destinations are eligible and when they
can be visited without overwhelming the destination site.

## Functional Requirements

- Accept seed URLs, discover links, fetch pages, and store content plus fetch metadata.
- Avoid redundant work and schedule revisits using a configurable freshness policy.
- Apply robots rules, configured host budgets, redirect limits, and exclusion policies.
- Provide crawl progress and operational controls. Search ranking and browser-based rendering are initially out of scope.

## Non-Functional Requirements

- Sustain the target crawl rate with bounded host traffic and bounded internal queues.
- Recover in-flight work after worker failure without claiming exactly-once fetches.
- Isolate slow or malicious destinations; expose freshness, errors, and backlog metrics.
- Prioritize coverage and politeness over interactive response latency.

## Scale

Assume 100 million known URLs across 1 million hosts and a target of 10 million
fetches/day. Typical content is 100 KB with a 10 MB fetch cap. Example per-host
budget is one concurrent request and at most one request/second; clarify overrides.

## Constraints

Pages can form cycles or generate unbounded URLs. Responses can hang, redirect
to private networks, or expand dramatically when decompressed. Treat robots
policy and fetch budgets as explicit product requirements, and do not bypass
access controls. Only permitted public HTTP/HTTPS destinations are in scope.

## Discussion

Compare deduplication accuracy with memory, freshness with bandwidth, and host
fairness with utilization. Consider a crawler trap, a very slow host, repeated
worker restarts, or a frontier that grows faster than it can be processed.

# Interviewer Context

Let the candidate clarify discovery versus recrawl priorities and URL identity.
Encourage a workspace diagram connecting discovery, scheduling, fetch, and storage.
Do not prescribe a frontier structure, filter, or partitioning key.

- Middle: useful URL/fetch data model, end-to-end workflow, host budgets, timeouts, and retry behavior.
- Senior: reason about queue growth, deduplication and canonicalization limits, distributed host coordination, unsafe destinations, and restart recovery.
- Staff: compare scheduler partitioning alternatives and plan repartitioning or policy migration with control over duplicate traffic and worker ownership.
- Principal: explore coverage/freshness objectives, cost and access-policy governance, or geographic operation where relevant; avoid requiring a full search engine design.

Choose a deep dive on host scheduling or an unbounded discovery workload. Tie
failure scenarios to the candidate's chosen components. Reward a bounded, useful
crawl rather than indiscriminate scale; avoid repetitive theoretical questions
and preserve time for architecture and the remaining interview flow.
