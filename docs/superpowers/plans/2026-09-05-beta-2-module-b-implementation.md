# Beta 2.0 Module B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing public YHCT social application into the approved responsive club social portal with secure posts, reactions, comments, profiles, activities, media, cursor pagination, and regression-safe Module A boundaries.

**Architecture:** Preserve Firebase Auth/RBAC and the independent ACC from Module A. Evolve the existing `post-service`, `comment-service`, Storage service, feed components, and Firestore rules into the Module B contract instead of creating a parallel social stack. Keep domain validation pure/testable, enforce privilege in Firestore/Storage rules, and keep UI components focused on orchestration and presentation.

**Tech Stack:** Next.js 16.3.4 App Router, React 19.2.8, TypeScript 5.9.3, Firebase 12.18.0, Firebase Admin 14.3.0, Tailwind CSS 4.3.3, Lucide React 1.40.0, Node 22.16+.

**Spec:** `docs/superpowers/specs/2026-09-05-beta-2-module-b-social-portal-design.md`

## Global Constraints

- Preserve role hierarchy exactly: `member < mod < super_mod < admin`.
- Custom Claims remain authoritative for privileged actions.
- `mustChangePassword=true` users cannot perform social mutations.
- Do not weaken `users/{uid}/private/*` or `clubProvisioning/*` protections.
- Do not commit private roster, activation passwords, phone lists, service-account JSON, or private member artifacts.
- Public app and `admin-portal` must both remain buildable.
- Feed reads are bounded and cursor-based; no unbounded collection reads.
- Module B supports image media only; video is deferred.
- No AI, messaging, payments, backup/restore execution, nested comment threads, push notifications, or recommendation ranking.

---

### Task 1: Module B social domain contracts

**Files:**
- Create: `tests-node/social-domain.test.mjs`
- Create: `lib/domain/social.ts`
- Modify: `lib/types.ts`

**Interfaces:**
- Produces `PostKind`, `PostVisibility`, `ReactionType`, `SocialPostDraft`, `validateSocialPostDraft()`, `buildSocialPostPayload()`, `validateCommentText()`, `normalizeReactionType()`.
- Social post payload includes immutable author snapshots, `reactionCount=0`, `commentCount=0`, `edited=false`, and `status='active'`.

- [ ] Write failing tests covering empty/oversized text, privileged kinds, allowed reaction types, comment length, initial counters, immutable author snapshot fields, and maximum six images.
- [ ] Run `npm test -- tests-node/social-domain.test.mjs`; expect failure because `lib/domain/social.ts` does not exist.
- [ ] Implement pure domain types/validation and update shared record types.
- [ ] Run focused test and `npm run check` until green.
- [ ] Commit with `feat: add Module B social domain contracts`.

### Task 2: Firestore and Storage authorization contracts

**Files:**
- Create: `tests-node/module-b-rules-contract.test.mjs`
- Create: `tests-node/module-b-storage-contract.test.mjs`
- Modify: `firestore.rules`
- Modify: `storage.rules`
- Modify: `firestore.indexes.json`

**Interfaces:**
- Firestore paths: `posts/{postId}`, `posts/{postId}/reactions/{uid}`, `posts/{postId}/comments/{commentId}`.
- Storage path: `social/posts/{uid}/{postId}/{mediaId}.{ext}`.

- [ ] Write failing contract tests asserting password-rotation gate, author ownership, privileged `club_news/activity_update`, immutable ownership/counters, reaction UID ownership, comment ownership, protected user fields, private-document denial, and storage subtree/MIME/size rules.
- [ ] Run focused rule contract tests and confirm red against current legacy `likes`/top-level comments rules.
- [ ] Add claim helpers including `clubMember` and `mustChangePassword`, then migrate social rules to nested reactions/comments and soft-delete semantics.
- [ ] Update Storage rules to claim-aware `social/posts/...` image uploads with a 10 MiB limit while preserving avatars/certificates.
- [ ] Add required post composite indexes for status/visibility/kind/activityId/authorId plus `createdAt desc`.
- [ ] Run focused contracts and full `npm run check` green.
- [ ] Commit with `security: enforce Module B social rules`.

### Task 3: Social Firestore and media services

**Files:**
- Create: `tests-node/social-service-contract.test.mjs`
- Modify: `lib/post-service.ts`
- Modify: `lib/comment-service.ts`
- Modify: `lib/storage-service.ts`
- Create: `lib/reaction-service.ts`

**Interfaces:**
- `createSocialPost({ profile, claims, draft, files, onUploadProgress }): Promise<string>`.
- `subscribeFeedPage()`/`loadFeedPage()` use bounded cursor pagination.
- `setPostReaction(postId, uid, type)` and `clearPostReaction(postId, uid)` are idempotent.
- `createPostComment()`, `editPostComment()`, `softDeletePostComment()` use nested post comments.

- [ ] Write contract tests for canonical Storage path generation, bounded page size, cursor constraints, transaction counter invariants, duplicate reaction handling, and comment counter floor at zero.
- [ ] Verify red where legacy services expose `likes` and top-level `comments`.
- [ ] Refactor post/media services to the Module B model and add reaction service using Firestore transactions.
- [ ] Refactor comment service to nested comments with transaction-backed `commentCount`.
- [ ] Preserve deterministic cleanup of uploaded media if post publish fails.
- [ ] Run focused tests and full check green.
- [ ] Commit with `feat: add Module B social data services`.

### Task 4: Responsive social portal shell and feed

**Files:**
- Create: `lib/navigation.ts`
- Modify: `components/app-shell.tsx`
- Modify: existing files under `components/feed/`
- Modify/Create focused files under `components/interactions/` and `components/comments/`
- Modify: `app/globals.css`
- Create: `app/feed/page.tsx`
- Create: `app/posts/[postId]/page.tsx`

**Interfaces:**
- Shared navigation entries: Feed, Activities, Members, Profile.
- Mobile bottom navigation, tablet rail, desktop left rail.
- Feed supports `all`, `club`, `members` filters and bounded load-more pagination.

- [ ] Add navigation/domain rendering contract tests in `tests-node/navigation-contract.test.mjs` before changing UI.
- [ ] Replace the single legacy board shell with route-aware responsive navigation while preserving auth entry points.
- [ ] Update composer for Module B post kinds and image upload rules; privileged kinds appear only when claims permit.
- [ ] Update feed cards for snapshots, media, counters, reactions, comments, soft-deleted/hidden states, loading/empty/error states.
- [ ] Add post permalink page reusing the same card/comment components.
- [ ] Run `npm run check` and production build green.
- [ ] Commit with `feat: build responsive Module B social feed`.

### Task 5: Member directory and self-service profile

**Files:**
- Create: `lib/member-service.ts`
- Create: `app/members/page.tsx`
- Create: `app/members/[uid]/page.tsx`
- Create: `app/profile/page.tsx`
- Create focused components under `components/members/`
- Modify Firestore contract tests if needed for self-service profile fields.

**Interfaces:**
- Directory exposes safe public club-profile fields only.
- Profile self-service writes are limited to `displayName`, `photoURL`, `bio`, `specialties`, and `updatedAt` where allowed by existing policy.
- Protected Module A fields remain immutable to ordinary clients.

- [ ] Add failing member/profile contract tests for safe projection and protected field filtering.
- [ ] Implement bounded directory query and member detail query.
- [ ] Implement current-user profile editor with explicit allow-list payload construction.
- [ ] Add recent-post query by `authorId` with cursor limit.
- [ ] Run focused tests, `npm run check`, and production build green.
- [ ] Commit with `feat: add member directory and profile portal`.

### Task 6: Club activities and related social updates

**Files:**
- Create: `lib/activity-service.ts`
- Create: `app/activities/page.tsx`
- Create: `app/activities/[id]/page.tsx`
- Create focused components under `components/activities/`

**Interfaces:**
- Activity list reads only published/visible activities.
- Activity detail loads one activity plus posts filtered by `activityId` using the committed composite index.
- Public app does not gain activity write authority.

- [ ] Add failing activity query contract tests for bounded reads and published-only behavior.
- [ ] Implement activity list/detail read services.
- [ ] Build activity list/detail UI and related social-post section.
- [ ] Run focused tests, full check, and production build green.
- [ ] Commit with `feat: add club activity discovery`.

### Task 7: CI integration gate and regression verification

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify Firebase deployment workflow only if index/rule deployment path requires it.

**Interfaces:**
- CI continues on pull requests and `main` pushes.
- CI additionally runs on pushes to `release/v1.0`.
- CI validates both public app and `admin-portal`.

- [ ] Add contract test checking CI trigger includes both `main` and `release/v1.0`.
- [ ] Update workflow trigger without removing existing jobs.
- [ ] Run root check/build and ACC check/build.
- [ ] Review Module B rule/index/storage changes against the approved spec.
- [ ] Verify no private artifacts or credentials are introduced.
- [ ] Commit with `ci: validate release branch integrations`.

### Task 8: Module B acceptance and integration

**Files:**
- Create: `docs/superpowers/reports/2026-09-05-beta-2-module-b-verification.md`

**Interfaces:**
- Verification report records exact CI run, public/ACC checks, rule contracts, build results, and deferred work.

- [ ] Run/observe fresh PR CI on the final branch head.
- [ ] Resolve all Critical/Important review findings before integration.
- [ ] Produce verification report with exact evidence.
- [ ] Merge the Module B PR into `release/v1.0` only after fresh green CI and mergeability verification.
- [ ] Verify post-merge integration CI now runs automatically on `release/v1.0`.
