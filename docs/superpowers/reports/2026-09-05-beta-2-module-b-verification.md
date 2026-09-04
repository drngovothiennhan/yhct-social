# Beta 2.0 Module B Verification Report

## Scope

Module B implements the approved social portal architecture on top of the Module A baseline `7c92a4762233802d9c72e9bdae8aae78bda6ddc0` without changing the authoritative RBAC, MSSV provisioning, mandatory password-rotation, or independent Admin Control Center boundaries.

## Delivered

- Responsive public portal with `/feed`, `/activities`, `/activities/[id]`, `/members`, `/members/[uid]`, `/profile`, and `/posts/[postId]`.
- Mobile bottom navigation and desktop three-column shell.
- Bounded cursor-based social feed with member/club filters.
- Member posts plus claim-gated `club_news` and `activity_update` publishing.
- Up to six JPEG/PNG/WebP images per post under `social/posts/{uid}/{postId}/...` with deterministic failed-upload cleanup.
- Nested idempotent reactions at `posts/{postId}/reactions/{uid}`.
- Nested comments at `posts/{postId}/comments/{commentId}` with owner edit/soft-delete contract.
- Safe member directory and explicit allow-list self-profile updates.
- Published-only activity discovery and related social updates.
- Firestore and Storage rules that require club membership and completed password rotation for social mutations.
- Module A private access/provisioning protections retained.
- Required Firestore composite indexes committed.
- CI now runs on pull requests, `main`, and integration pushes to `release/v1.0`.
- Beta Firebase rules/index deployment workflow now runs automatically on relevant `release/v1.0` policy changes using existing keyless WIF authentication.

## Security decision: counters

`reactionCount` and `commentCount` remain server-owned cache fields initialized at zero and immutable to ordinary public-app clients. Module B derives live interaction counts from the nested reaction/comment collections. This avoids granting a client arbitrary parent-counter mutation authority. A later trusted server reconciliation/counter updater may maintain the cache fields without changing the UI data contract.

## TDD evidence

- CI #117: social-domain RED confirmed only because `lib/domain/social.ts` did not yet exist.
- CI #121: Firestore/Storage RED confirmed legacy rules lacked the Module B authorization contract.
- CI #125: social-service RED confirmed only because the nested reaction service did not yet exist.
- CI #130: portal RED confirmed only because the new navigation/portal layer did not yet exist.
- Subsequent GREEN runs preserved both public and ACC validation while each layer was implemented.

## Final branch verification before this report

PR: #4 `beta 2.0: Module B social portal`

Verified head before report: `2892580906c680e358c378260bc6374a8a415c34`.

GitHub Actions CI #135 (`33921528772`):

- `validate-public`: SUCCESS.
  - dependency install: success
  - tests: 83 passed, 0 failed
  - TypeScript typecheck: success
  - ESLint: success
  - Next.js production build: success
- `validate-acc`: SUCCESS.
  - ACC tests/typecheck/lint: success
  - ACC production build: success

## Review findings

- PR changed-file review contains only application source, tests, security rules/indexes, workflows, specs/plans, and this verification report.
- No roster CSV, phone list, activation credential file, Firebase private key, service-account JSON, or other private member artifact is part of the Module B change set.
- Public social UI does not write Custom Claims, role, member code/provisioning identity, account status, or `users/{uid}/private/*`.
- Legacy v1 post/like/comment paths remain temporarily compatible while new Module B clients use the new nested model; the security default remains deny.

## Acceptance mapping

- Responsive social feed: implemented and production-build verified.
- Text/image publishing: implemented with domain validation, rule validation, and Storage limits.
- Reactions/comments: implemented as nested, user-owned, idempotent/soft-delete-capable data.
- Safe member discovery/profile: implemented with bounded reads and self-update allow-list.
- Activity discovery: published-only and bounded.
- Privileged club publishing: enforced by claims/rules independently of UI presentation.
- Module A boundaries: retained and covered by regression contract tests.
- Cursor pagination: implemented with a hard maximum page size of 20.
- ACC independence: verified by independent ACC CI/build.
- Integration branch CI: configured for `release/v1.0`.

## Deferred by approved Module B scope

AI/recommendation features, direct messaging, video transcoding, nested comment threads, push notifications, backup/restore execution, payments, and analytics warehouse/event-pipeline work remain separate future modules.
