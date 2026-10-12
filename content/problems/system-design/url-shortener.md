---
id: url-shortener
title: Design a URL Shortener
interview: system-design
difficulty: medium
categories:
  - distributed-systems
  - backend
topics:
  - caching
  - data-modeling
  - scalability
  - availability
companies:
  - Bitly
---

## Description

Design a URL shortening service similar to Bitly or TinyURL.

Users should be able to create a short URL for a long URL and use the short URL to redirect to the original destination.

### Example

Long URL: `https://example.com/articles/designing-distributed-systems` → Short URL: `https://short.ly/abc123`

## Functional Requirements

- Create a short URL from a long URL
- Redirect a short URL to the original URL
- Support custom aliases
- Support optional expiration dates

## Non-Functional Requirements

- High availability
- Low redirect latency
- Horizontal scalability
- Short URLs must be unique
- Redirects should remain reliable under high traffic
- Target 99.99% redirect availability and less than 100 ms p99 redirect latency within a region, excluding client-network latency.
- Clarify how quickly alias changes and expiration must affect reads.

## Scale

Assume:

- 100 million new URLs per month
- 10 billion redirects per month
- Read-heavy workload
- URLs may live for several years
- Plan for peaks around 50000 redirects/second and highly skewed popularity; monthly averages alone do not size capacity.

## Constraints

Custom aliases are unique within the service's namespace. Agree on whether expired
aliases can be reused, and what that means for old bookmarks. Redirect destinations
are untrusted input; discuss permitted URL schemes, abuse handling, and privacy
of access logs. Analytics and accounts may be scoped as extensions. Initial
workload and targets are reasonable planning assumptions, open to clarification.

## Discussion

Interviewer guidance: let the candidate discover requirements and scale through clarifying questions. Explore:

- API design
- Short code generation
- Data model
- Storage
- Caching
- Scaling
- Availability
- Failure scenarios
- Trade-offs

Compare short-code allocation with write coordination, redirect freshness with
cache efficiency, and regional availability with namespace consistency. Explore a
hot link, cache or storage loss, a conflicting custom alias, or an expired link
remaining in a cache. No particular storage product or allocation scheme is required.

# Interviewer Context

If the candidate asks for scale, use approximately:

- 100 million new URLs per month
- A 100:1 read/write ratio
- Globally distributed users

Useful follow-up areas include short-code generation, storage, caching, hot URLs, availability, expiration, consistency, and abuse. Do not volunteer every constraint immediately.

Encourage a workspace diagram showing create and redirect paths, including where
the short-code mapping lives. Use the existing System Design definition's flow;
do not prescribe components or stage dialogue. Select one or two deep dives
based on the candidate's proposal, such as alias uniqueness or hot-link reads.

- Middle: coherent create/redirect APIs, mapping data, uniqueness handling, and a basic reliable end-to-end flow.
- Senior: quantify read-heavy bottlenecks, justify caching and consistency, and handle alias races, expiration, and failures with operational metrics.
- Staff: compare allocation and geographic-serving alternatives and propose a safe mapping-store or identifier migration while preserving existing links and ownership boundaries.
- Principal: examine namespace longevity, abuse and privacy policy, regional recovery, and cost as the service grows; prioritize consequences relevant to the chosen design.

Introduce failures only in components the candidate actually proposes. Avoid
repeating cache or consistency questions once evidence is clear. Advanced topics
are optional opportunities, not a checklist required for a positive evaluation.
Keep expectations proportional to the configured duration and leave time for
architecture design, relevant failures, trade-offs, and reflection.
