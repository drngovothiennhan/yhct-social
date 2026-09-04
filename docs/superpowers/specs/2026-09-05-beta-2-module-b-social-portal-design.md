# YHCT Social Beta 2.0 — Module B Social Portal Architecture

## Scope

Module B turns the public YHCT Social application into a usable club social portal while preserving every security and administration boundary introduced by Module A.

Module B delivers five independently testable product areas:

1. Responsive social portal shell and navigation.
2. Member profiles with club-facing identity and activity summary.
3. Authenticated post publishing with optional Firebase Storage media.
4. Reactions and comments with deterministic counters and abuse-resistant write rules.
5. Club activity/news discovery surfaces that reuse the same social content model rather than creating a second parallel publishing system.

Module B does not change the Module A role hierarchy, provisioning model, activation-password flow, ACC deployment boundary, or Firebase project. It does not implement AI features, backup/restore execution, private messaging, payments, or recommendation algorithms.

## Baseline

The baseline is merge commit `7c92a4762233802d9c72e9bdae8aae78bda6ddc0` on `release/v1.0`.

Module A already provides:

- Firebase Auth with MSSV alias login.
- Custom Claims with `member < mod < super_mod < admin`.
- mandatory first-login password rotation.
- Firestore claim-first privileged authorization.
- an independent Admin Control Center under `admin-portal/`.
- shared production Firebase project `yhct-social-260902-42a4`.

Module B must not bypass or duplicate those mechanisms.

## Product principles

### Security first

The browser may request social mutations, but authorization remains enforced by Firebase Auth plus Firestore/Storage rules. No public-app component may write role, account status, provisioning fields, Custom Claims, or ACC-managed private metadata.

### One social content model

Club news and ordinary member posts use the same `posts` collection with explicit metadata such as `kind`, `visibility`, `authorRoleSnapshot`, and optional `activityId`. There must not be separate incompatible feeds that require duplicate reaction/comment logic.

### Mobile first

The primary interaction target is a phone viewport. Desktop expands the shell but does not introduce a separate information architecture.

### Progressive enhancement

Core feed reading, profile reading, publishing, reacting, and commenting must work without AI or background jobs. Counters may be denormalized for read performance but the source-of-truth documents remain individually auditable.

## Information architecture

### Public application routes

The public Next.js App Router application will expose these primary routes:

- `/` — authenticated social home/feed; unauthenticated visitors see the existing club landing/login entry point.
- `/feed` — canonical feed route, with `/` allowed to redirect or render the same feed for authenticated users.
- `/members` — searchable member directory using public club-profile fields only.
- `/members/[uid]` — member profile and recent social activity.
- `/activities` — club activities/news discovery.
- `/activities/[id]` — activity detail plus related posts.
- `/posts/[postId]` — permalink for one post with comments.
- `/profile` — current-user profile editor for self-service fields allowed by rules.

The Admin Control Center remains a separate application and is never mounted under these public routes.

## Responsive shell

The shell has three navigation modes sharing one route model:

- mobile: bottom navigation for Feed, Activities, Members, Profile; creation action is visually prominent.
- tablet: compact side rail.
- desktop: left navigation rail, center content column, optional right contextual panel.

Navigation is role-aware only for presentation. Privileged ACC access may be shown as an external link for eligible users, but permission checks remain server-side in ACC.

## Member profile model

Existing `users/{uid}` remains the canonical public member profile document. Module B may read existing Module A fields and add only self-service display fields that are explicitly protected by Firestore rules.

Expected display fields include:

- `displayName`
- `photoURL`
- `bio`
- `faculty`
- `professionalTitle`
- `clubTitle`
- `studentId`
- `role`
- `accountStatus`
- `joinedAt`
- `profileUpdatedAt`

Self-service writes are limited to fields such as `displayName`, `photoURL`, and `bio` unless an existing rule already permits more. `role`, `clubTitle`, `studentId`, `accountStatus`, provisioning metadata, and verification state are never writable by an ordinary client profile update.

## Social data model

### `posts/{postId}`

Required fields:

- `authorId: string`
- `authorNameSnapshot: string`
- `authorPhotoSnapshot: string | null`
- `authorRoleSnapshot: 'member' | 'mod' | 'super_mod' | 'admin'`
- `kind: 'member_post' | 'club_news' | 'activity_update'`
- `visibility: 'members' | 'public'`
- `text: string`
- `media: PostMedia[]`
- `activityId: string | null`
- `reactionCount: number`
- `commentCount: number`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`
- `edited: boolean`
- `status: 'active' | 'hidden' | 'deleted'`

`PostMedia` contains only durable Storage metadata required for rendering:

- `type: 'image'`
- `storagePath: string`
- `downloadURL: string`
- `width: number | null`
- `height: number | null`

Module B v1 supports images only. Video transcoding is outside scope.

### `posts/{postId}/reactions/{uid}`

One document per reacting user provides idempotency.

Fields:

- `uid: string`
- `type: 'like' | 'heart' | 'support'`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`

A user may have at most one active reaction document per post. Changing reaction type updates the same document.

### `posts/{postId}/comments/{commentId}`

Fields:

- `authorId: string`
- `authorNameSnapshot: string`
- `authorPhotoSnapshot: string | null`
- `text: string`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`
- `edited: boolean`
- `status: 'active' | 'hidden' | 'deleted'`

Nested reply threads are deliberately excluded from Module B to avoid unbounded query complexity. Replies can be introduced later with an explicit parent model.

### `activities/{activityId}`

Module B consumes the existing activity domain if present and normalizes UI access around:

- `title`
- `description`
- `startAt`
- `endAt`
- `location`
- `coverImageURL`
- `status`
- `createdBy`
- `createdAt`
- `updatedAt`

Posts may reference an activity through `activityId`, allowing an activity page to aggregate related social updates without duplicating content.

## Authorization model

### Read access

- `visibility='public'` posts may be read without authentication if existing privacy policy permits public news.
- `visibility='members'` posts require an authenticated club member.
- hidden/deleted content is not visible to ordinary members.
- member directory exposes only public club-profile fields, never `users/{uid}/private/*`.

### Post creation

Authenticated club members with `mustChangePassword=false` may create `member_post` documents for themselves.

Only `mod`, `super_mod`, or `admin` may create `club_news` or `activity_update` posts.

Clients may not submit another user's `authorId`, privileged role snapshot, server counters, hidden status, or arbitrary Storage paths. Rules must validate immutable ownership and allowed initial values.

### Post editing and deletion

- authors may edit their own active member posts within the allowed mutable field set.
- moderators may hide content according to role policy.
- ordinary users cannot rewrite ownership, counters, timestamps, visibility beyond their allowed scope, or convert a member post into privileged club news.
- destructive deletion should use soft-delete status first so moderation and audit behavior remain deterministic.

### Reactions

Authenticated club members with completed password rotation may create/update/delete only `reactions/{theirUid}`.

Rules validate `uid == request.auth.uid` and allowed reaction types.

### Comments

Authenticated club members with completed password rotation may create comments as themselves.

Authors may edit or soft-delete their own comments. Moderators may hide comments. Ownership fields and creation timestamps are immutable after creation.

## Counter consistency

`reactionCount` and `commentCount` are denormalized read optimizations.

The initial Module B implementation uses Firestore transactions from trusted application service functions to update the child document and parent counter together. The client must never be allowed to arbitrarily set a post counter.

Counter service functions must be idempotent against repeated create/delete requests and prevent negative counts.

If transaction-based counters become a scaling bottleneck later, distributed counters or server-triggered reconciliation may replace the implementation without changing the UI contracts.

## Media upload design

Media uploads use Firebase Storage.

Canonical path:

`social/posts/{uid}/{postId}/{mediaId}.{ext}`

Rules require:

- authenticated owner matches `{uid}`.
- completed password rotation.
- image MIME types only for Module B.
- per-file size limit defined in Storage rules.
- users cannot upload into another user's subtree.

Post creation must not reference a Storage path outside the author's post subtree unless it is a pre-existing trusted club asset.

Failed uploads must be removable without leaving a published post that references unavailable media.

## Feed query model

The first release uses deterministic reverse-chronological ordering rather than recommendation ranking.

Default feed order:

`createdAt desc`

Supported filters:

- all visible posts.
- club news/activity updates.
- member posts.
- posts linked to a specific activity.
- posts by a specific member.

Pagination uses Firestore cursors, not offset pagination.

The page size is bounded and the UI uses explicit load-more or cursor-based infinite loading with duplicate protection.

## Member directory

The member directory is for club discovery, not administration.

It supports search/filter using fields that can be exposed safely, such as display name, faculty, and club title. It does not expose activation state details, private contact data, private access metadata, or provisioning ledger content.

Administrative account search remains in ACC.

## Activity experience

`/activities` provides chronological club events and activity notices. `/activities/[id]` renders activity details plus posts whose `activityId` matches the activity.

Activity creation/edit authority continues to follow the existing privileged activity policy. Module B must not broaden activity writes merely to simplify UI development.

## Client architecture

Social behavior is split into focused units rather than one large feed component.

Expected boundaries:

- domain types and validation for posts/reactions/comments.
- Firestore service functions for feed queries and mutations.
- Storage service for media upload/removal.
- reusable feed card and composer components.
- reaction controls isolated from comment controls.
- route-level components responsible for data orchestration, not authorization policy.

Firebase initialization remains shared through the existing client infrastructure.

## Error handling

The public UI must distinguish:

- authentication required.
- password rotation required.
- authorization denied.
- invalid/oversized media.
- post/comment validation failure.
- transient Firebase/network failure.

Optimistic UI is allowed only when rollback is deterministic. Failed reaction/comment mutations must restore the previous local state and never leave impossible negative counters.

Sensitive Firebase exceptions, claims, private metadata, and Storage internals are not rendered to end users.

## Moderation boundary

Module B introduces only the minimum moderation required to keep social features safe:

- author self-edit and soft-delete.
- moderator hide/unhide where already permitted by role hierarchy.
- no client-side role escalation.
- no bulk moderation tools in the public app.

Bulk moderation, account disable/enable, role management, and verification remain ACC responsibilities.

## Firestore indexes

Module B may require composite indexes for queries such as:

- `posts(status, visibility, createdAt desc)`
- `posts(status, kind, createdAt desc)`
- `posts(status, activityId, createdAt desc)`
- `posts(status, authorId, createdAt desc)`

Required indexes must be committed through `firestore.indexes.json` and validated as part of CI/deployment contracts.

## Performance targets

For the initial club scale, optimize for hundreds to low thousands of members without introducing unnecessary distributed infrastructure.

Targets:

- bounded feed reads per page.
- no N+1 user-profile fetch for every post; snapshots embedded in post/comment documents are used for feed rendering.
- image dimensions stored when available to reduce layout shift.
- Firestore realtime listeners limited to screens where live updates materially improve UX.
- no unbounded collection reads.

## Accessibility and UX quality

Interactive controls must be keyboard accessible and have explicit accessible labels where icon-only controls are used.

Mobile tap targets must be practical for touch interaction. Loading, empty, error, disabled, and offline/transient states must be designed rather than falling back to blank screens.

The visual language should remain appropriate for a professional medical club: clear hierarchy, restrained motion, readable Vietnamese typography, and high information clarity.

## Security rule migration tests

Module B is not accepted unless contract tests demonstrate at least:

1. unauthenticated users cannot create posts/reactions/comments.
2. members cannot create content for another author.
3. members cannot create `club_news` or `activity_update` without required claims.
4. clients cannot set arbitrary reaction/comment counters.
5. one user's reaction document cannot be written by another user.
6. comment ownership is immutable.
7. protected user profile fields remain protected after profile-editor changes.
8. private Module A documents and provisioning ledger remain inaccessible.
9. password-rotation-required accounts cannot perform member social mutations.
10. Storage users cannot write outside their own post subtree or upload disallowed file types/sizes.

## Test gates

Module B requires:

- domain unit tests for post/comment/reaction validation.
- Firestore rules contract tests.
- Storage rules contract tests.
- feed query/cursor tests using deterministic fixtures.
- reaction idempotency and counter tests.
- comment create/edit/delete counter tests.
- component tests for composer validation and role-aware rendering where practical.
- root `npm run check` green.
- root production Next.js build green.
- `admin-portal` check and production build remain green to prove Module B did not break Module A isolation.

## CI contract adjustment

Because integration currently targets `release/v1.0`, Module B must update CI so pushes to `release/v1.0` also execute the same public and ACC validation jobs that currently run for `main` and pull requests. This closes the verification gap observed immediately after merging Module A.

The change must not remove existing `main` or pull-request triggers.

## Deployment boundary

- public application remains the existing Vercel public project.
- ACC remains the dedicated admin Vercel project.
- Firestore/Auth/Storage remain shared Firebase services.
- Module B deploys no long-lived Google service-account key.
- no private roster, activation credential, phone list, or private member artifact enters the repository or public build.

## Acceptance criteria

Module B is complete when:

- authenticated club members can browse a responsive social feed.
- authorized members can publish text posts and image media within validated limits.
- members can react and comment idempotently without corrupting counters.
- members can browse safe club-profile information and activity pages.
- privileged club news/activity publishing is claim-gated.
- self-service profile editing cannot modify protected Module A fields.
- Firestore and Storage rules enforce the social model independently of the UI.
- pagination is cursor-based and bounded.
- public application check/build passes.
- ACC check/build still passes unchanged in authority and deployment independence.
- CI also validates integration pushes to `release/v1.0`.

## Explicitly deferred work

The following are not part of Module B and require separate specifications:

- AI assistant, semantic search, content generation, or recommendation ranking.
- direct/private messaging.
- video processing/transcoding.
- nested comment threads.
- push notifications.
- backup/restore engine execution.
- analytics warehouse or large-scale event pipeline.
- payment/membership billing.
