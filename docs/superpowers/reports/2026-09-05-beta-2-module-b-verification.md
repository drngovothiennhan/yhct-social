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
- CI runs on pull requests, `main`, and integration pushes to `release/v1.0`.
- `release/v1.0` validates Firebase policy/contracts without requesting production Google Cloud credentials.
- Production Firebase rules/index deployment remains centralized in `.github/workflows/deploy-firebase-rules.yml` on `main`, using the existing `github-main` WIF provider.

## Security decision: counters

`reactionCount` and `commentCount` remain server-owned cache fields initialized at zero and immutable to ordinary public-app clients. Module B derives live interaction counts from the nested reaction/comment collections. This avoids granting a client arbitrary parent-counter mutation authority. A later trusted server reconciliation/counter updater may maintain the cache fields without changing the UI data contract.

## TDD evidence

- CI #117: social-domain RED confirmed only because `lib/domain/social.ts` did not yet exist.
- CI #121: Firestore/Storage RED confirmed legacy rules lacked the Module B authorization contract.
- CI #125: social-service RED confirmed only because the nested reaction service did not yet exist.
- CI #130: portal RED confirmed only because the new navigation/portal layer did not yet exist.
- CI #140 on commit `eb977e03de84948b810f1fe1f28bd6c1663f2a5c`: RED reproduced the release-workflow trust-boundary defect; the new contract rejected use of `github-main` WIF from `release/v1.0`.
- Commit `060c7785f2b2ad558b61e2f88dc6e2200034b188`: minimal GREEN fix converted the Beta 2 workflow to validation-only and preserved production deployment on `main`.

## Integration and final verification

PR #4 `beta 2.0: Module B social portal` was merged into `release/v1.0`.

Merge commit: `699b47cea25133b1d6acf79cb479109ba9224863`.

Pre-merge verification:

- CI #135 (`33921528772`): public 83/83 tests, TypeScript, ESLint, Next.js production build, ACC validation and ACC production build all SUCCESS.
- CI #136 on verification head `8b0e81218bbd9a22ddccff484d9652a14debf540`: SUCCESS.

Post-merge trust-boundary investigation:

- The first Beta 2 policy deployment attempt from `release/v1.0` was correctly rejected by Google STS with `unauthorized_client` because provider `github-main` did not trust the release ref.
- The canonical production workflow was inspected and confirmed to deploy from `main` with that provider.
- The release workflow was corrected instead of weakening the WIF attribute condition or creating a broader credential.

Post-fix verification on `060c7785f2b2ad558b61e2f88dc6e2200034b188`:

- CI push #141 (`33922468251`): `validate-public` SUCCESS and `validate-acc` SUCCESS, including both production builds.
- Validate Beta 2.0 Firebase Policy #4 (`33922468209`): SUCCESS, including full application/policy contract validation and production-deployment-boundary confirmation.

## Review findings

- Module B changed files contain application source, tests, security rules/indexes, workflows, specs/plans, and verification documentation only.
- No roster CSV, phone list, activation credential file, Firebase private key, service-account JSON, or other private member artifact is part of the Module B change set.
- Public social UI does not write Custom Claims, role, member code/provisioning identity, account status, or `users/{uid}/private/*`.
- Legacy v1 post/like/comment paths remain temporarily compatible while new Module B clients use the new nested model; the security default remains deny.
- The production WIF boundary was kept strict: release validation is credential-free; production deployment is delegated to the existing `main` workflow.

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
- Integration branch CI: verified on `release/v1.0`.
- Firebase policy validation: verified on `release/v1.0` without broadening production credentials.

## Release-boundary note

Module B is integrated and verified on `release/v1.0`. Actual production Firebase policy deployment is intentionally not performed from this branch. It occurs through the existing trusted `main` release workflow when the wider release is promoted to `main`; that promotion is governed by the broader v1.0 release gates in PR #2 and is not bypassed by Module B.

## Deferred by approved Module B scope

AI/recommendation features, direct messaging, video transcoding, nested comment threads, push notifications, backup/restore execution, payments, and analytics warehouse/event-pipeline work remain separate future modules.
