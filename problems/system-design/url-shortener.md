---
id: url-shortener
title: Design a URL Shortener
interview: system-design
complexity: low
tags:
  - distributed-systems
  - scalability
  - caching
interviewerContext: |
  Keep the exercise focused on the redirect path, identifier generation,
  persistence, caching, and failure behavior.
---

# Design a URL Shortener

Design a URL shortening service similar to Bitly or TinyURL.

Users should be able to create a short URL for a long URL and use the short URL to redirect to the original destination.

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

Be prepared to discuss:

- API design
- Short code generation
- Data model
- Storage
- Caching
- Scaling
- Availability
- Failure scenarios
- Trade-offs
