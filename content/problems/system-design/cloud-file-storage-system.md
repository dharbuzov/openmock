---
id: cloud-file-storage-system
title: Design a Cloud File Storage System
interview: system-design
difficulty: hard
categories:
  - distributed-systems
  - backend
topics:
  - object-storage
  - synchronization
  - consistency
  - data-modeling
companies: []
---

## Description

Design a cloud service where users upload files, organize folders, share access,
and synchronize changes across devices. Support resumable transfers and make the
meaning of a completed upload and a conflicting edit explicit.

### Example

A laptop loses connectivity halfway through uploading a large file and resumes
later. Meanwhile, another device edits the same logical file. Users should have
a clear result rather than silent data loss or an inaccessible partial upload.

## Functional Requirements

- Upload, download, rename, and delete files and folders.
- Resume interrupted uploads and list changes for device synchronization.
- Share files with explicit read/write permissions and revoke access.
- Maintain recoverable file versions; collaborative document editing is out of scope.

## Non-Functional Requirements

- Target 99.9% metadata API availability and less than 300 ms p99 metadata reads.
- Accepted file versions must survive a storage-node loss; design integrity checks and recovery.
- Large transfers should not block metadata operations or small files.
- Clarify consistency for namespace changes, conflict handling, and deletion retention.

## Scale

Assume 5 million daily active users, 20 million uploads/day, 100 PB of stored
data, and files ranging from 1 KB to 10 GB. Most operations are reads or metadata
checks; a small fraction of users produce most stored bytes.

## Constraints

Separate logical file identity from a particular version. Networks and devices
can retry stale operations. Shared access can be revoked during a download.
Storage primitives may be purchased rather than built; justify their guarantees
instead of redesigning disks. Negotiate retention and quota policy.

## Discussion

Compare transfer granularity with metadata cost, sync freshness with device load,
and version retention with recovery cost. Consider an incomplete transfer,
conflicting edits, orphaned content, or loss of a metadata replica.

# Interviewer Context

Clarify sync and sharing expectations before adding features. Ask the candidate
to draw upload completion, download authorization, and change discovery. Do not
prescribe chunking, a manifest format, or conflict resolution policy.

- Middle: coherent file/version/permission model, transfer and listing APIs, and retry-safe completion with basic recovery.
- Senior: reason about namespace and content consistency, resumable transfers, concurrent edits, quotas, and cleanup without deleting referenced data.
- Staff: compare storage and synchronization boundaries and plan metadata or content migrations while preserving version identity and mixed client compatibility.
- Principal: assess provider dependence, durability/recovery evidence, geographic placement, retention policy, and cost ownership where relevant to the proposed architecture.

Deep dives may focus on upload commit integrity or synchronization conflicts.
Introduce a failure at a boundary the candidate actually designed. Cover one
substantial path rather than all sharing and storage variants; advanced topics
are optional evidence opportunities, not a mandatory checklist. Keep time for
the definition's full flow and candidate reflection.
