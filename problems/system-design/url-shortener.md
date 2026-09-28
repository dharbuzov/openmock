---
id: url-shortener
title: Design a URL Shortener
type: system-design
level: senior
tags:
  - distributed-systems
  - scalability
  - caching
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