---
id: url-shortener
title: Design a URL Shortener
interview: system-design
type: system-design
difficulty: medium
level: senior
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
tags:
  - high-scale
  - caching
  - databases
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

## Scale

Assume:

- 100 million new URLs per month
- 10 billion redirects per month
- Read-heavy workload
- URLs may live for several years

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

# Interviewer Context

If the candidate asks for scale, use approximately:

- 100 million new URLs per month
- A 100:1 read/write ratio
- Globally distributed users

Useful follow-up areas include short-code generation, storage, caching, hot URLs, availability, expiration, consistency, and abuse. Do not volunteer every constraint immediately.
