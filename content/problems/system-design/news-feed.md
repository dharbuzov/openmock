---
id: news-feed
title: Design a News Feed
interview: system-design
difficulty: hard
categories:
  - distributed-systems
  - backend
topics:
  - fan-out
  - caching
  - data-modeling
  - scalability
companies: []
---

## Description

Design a feed showing posts from accounts a user follows. Start with reverse
chronological ordering and leave room to discuss ranking later. Users should
publish posts, follow accounts, and page through their feeds despite large
differences in follower counts.

### Example

A user follows a friend and a popular creator. Both publish while the user is
offline. On returning, the user sees permitted recent posts and can fetch older
pages without missing or endlessly repeating items as new posts arrive.

## Functional Requirements

- Publish text posts with references to separately stored media.
- Follow and unfollow accounts; read a paginated feed.
- Respect deleted posts, private accounts, and blocking rules.
- Content ranking, recommendations, ads, and media transcoding are optional extensions, not initial requirements.

## Non-Functional Requirements

- Target less than 300 ms p99 feed reads and 99.95% read availability.
- Ordinary new posts should become visible within 5 seconds under normal load.
- Clarify acceptable staleness and which privacy changes require stronger guarantees.
- Bound write amplification, storage growth, and recovery time after a backlog.

## Scale

Assume 20 million daily active users, 200 million feed reads/day, 10 million
posts/day, and 20 million accounts. An ordinary account has 200 followers;
a popular account can have 10 million. Reads peak around 30000/second.

## Constraints

Follower distributions are skewed, not uniform. Users need not receive all posts
before opening the app. Deleted or unauthorized content must not remain accessible
just because a feed entry was cached. Agree on retention and pagination semantics.

## Discussion

Compare work performed when publishing with work performed when reading, freshness
with cost, and precomputed feeds with request-time personalization. Consider a
celebrity burst, delayed propagation, changing follows, or deletion during pagination.

# Interviewer Context

Let the candidate scope chronology, ranking, and privacy. Encourage a workspace
diagram that traces publication and feed reads for both ordinary and popular
accounts. Do not reveal a required fan-out strategy or cache arrangement.

- Middle: define post/follow data, publish and feed APIs, pagination, and a basic reliable read/write flow; acknowledge follower skew.
- Senior: estimate amplification and bottlenecks, justify handling hot publishers, and address freshness, duplicate entries, and privacy-sensitive invalidation.
- Staff: compare materialization alternatives and propose a reversible migration as workload changes, including rebuild costs and ownership across feed and social-graph teams.
- Principal: discuss how ranking or regional expansion changes system boundaries, long-term cost, privacy guarantees, and rollout risk without requiring a full recommendation system.

Choose a deep dive on hot publishers or pagination/invalidation, based on the
design. Use a realistic backlog or privacy change for failure discussion. Do not
cover every ranking idea or repeatedly ask about the same bottleneck. Positive
evaluation depends on justified decisions and relevant evidence within the duration.
