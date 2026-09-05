# YHCT Social Beta 2.0 — Module D Club Operations & Points Ledger

## Scope

Module D makes club activities, attendance, member points, and recognitions a coherent operational subsystem. It closes the business loop from creating an activity through recording participation and points to showing trustworthy member history and recognition.

Module D delivers seven independently testable product areas:

1. Activity lifecycle management in the Admin Control Center (ACC).
2. Member registration and moderator attendance tracking.
3. Append-only point ledger as the authoritative score history.
4. Server-owned member point aggregates for fast reads.
5. Member activity/point history in the public application.
6. Manual recognition records linked to authoritative activity/point history.
7. Audit-complete privileged operations with bounded queries and production isolation.

Module D does not add chat, payments, push notifications, automated recognition thresholds, AI scoring, diagnosis/treatment logic, or a second identity/authorization system.

## Baseline and branch boundary

The integration baseline is `release/v1.0` commit `6c7253e9c1eac46ae2581a126e2f40d044a7bde8`.

The production baseline remains `main` commit `031a347499ea29330f800c0254437337a46376e0` until an explicit production promotion is approved.

Module D develops only on `beta/2.0-module-d` until feature and post-merge release verification gates are green. Direct feature development on `main` is forbidden.

Existing production boundaries remain authoritative:

- public application: existing Next.js App Router Vercel project.
- ACC: independent Next.js application under `admin-portal/`.
- backend: Firebase Auth, Firestore and existing server-side Firebase Admin patterns.
- role hierarchy: `member < mod < super_mod < admin`.
- `mustChangePassword=true` blocks protected mutations.
- production Google workload identity remains scoped to the existing `main` trust boundary.
- no service-account JSON and no Firebase token fallback.

## Existing activity capability preserved

The existing public activity service currently exposes published activities only and is read-only from the browser. Module D extends this behavior rather than replacing the public activity concept.

Published-only public discovery remains the default. Draft, closed-management metadata, attendance control, points and audit data stay outside ordinary client write authority.

## Product principles

### Ledger before mutable totals

`users/{uid}` must not become the source of truth for points. A mutable `totalPoints` field on a user profile would make corrections unauditable and vulnerable to drift.

Module D uses:

- `pointLedger/{entryId}` as the authoritative append-only score history.
- `memberStats/{uid}` as a server-owned aggregate projection for fast reads.

Every score-changing operation writes the ledger entry and aggregate change in one trusted transaction.

### Correct by compensation, never rewriting history

A bad score is corrected by adding a reversal or correction entry. Existing point ledger records are not edited or deleted during normal operations.

This gives a complete historical trail and makes retry/idempotency behavior deterministic.

### Participation is not points

Attendance/participation state and points are related but independent facts. A member may attend and receive zero points, be excused, or receive an authorized correction later.

`activityParticipation` stores participation lifecycle. `pointLedger` stores score history.

### Server authority for club operations

Ordinary browser clients never write attendance, ledger entries, member aggregates, recognitions, activity management state, or administrative audit events directly.

Privileged mutations execute through ACC server routes using Firebase Admin after bearer-token verification, password-rotation gate, RBAC validation, payload validation and state-transition checks.

### Bounded reads and explicit lifecycle

All operational queues use bounded cursor pagination. Activity and score lifecycle states are explicit, not inferred from free-text fields or timestamps alone.

## Activity model

### `activities/{activityId}`

Canonical lifecycle:

- `draft`
- `published`
- `closed`
- `cancelled`

Required core fields:

- `title: string`
- `description: string`
- `startAt: Timestamp`
- `endAt: Timestamp | null`
- `location: string`
- `coverImageURL: string`
- `status: 'draft' | 'published' | 'closed' | 'cancelled'`
- `createdBy: string`
- `createdAt: Timestamp`
- `updatedBy: string`
- `updatedAt: Timestamp`

Operational fields:

- `registrationMode: 'closed' | 'member_self_register'`
- `registrationDeadline: Timestamp | null`
- `capacity: number | null`
- `scoringPolicy: ActivityScoringPolicy`
- `policyLockedAt: Timestamp | null`
- `closedAt: Timestamp | null`
- `cancelledAt: Timestamp | null`
- `cancellationReason: string | null`

### `ActivityScoringPolicy`

Module D v1 stores a small explicit policy snapshot on the activity so score decisions remain interpretable later.

Fields:

- `attendancePoints: number`
- `maxBonusPoints: number`
- `notes: string`
- `version: 1`

Point values must be finite integers within server-defined safe limits. Module D does not create arbitrary formula evaluation or AI scoring.

### Activity lifecycle transitions

Allowed normal transitions:

- `draft -> published`
- `draft -> cancelled`
- `published -> closed`
- `published -> cancelled`

`closed` and `cancelled` are terminal for normal operations.

An admin may edit a draft freely within validation limits. After publication, identity-defining fields may still receive safe corrections before the activity starts, but scoring policy becomes immutable at `policyLockedAt`, no later than `startAt`.

After an activity starts, policy changes are rejected. Exceptional score corrections use ledger correction entries instead of changing the historical policy.

## Participation model

### `activityParticipation/{participationId}`

Global collection with deterministic document ID:

`{activityId}__{uid}`

Fields:

- `activityId: string`
- `uid: string`
- `status: 'registered' | 'attended' | 'absent' | 'excused'`
- `registeredAt: Timestamp | null`
- `registeredBy: string | null`
- `attendanceMarkedAt: Timestamp | null`
- `attendanceMarkedBy: string | null`
- `updatedAt: Timestamp`

Deterministic IDs make the record unique per member/activity and provide direct lookup without duplicate attendance rows.

### Member self-registration

A signed-in club member with `mustChangePassword=false` may self-register only when:

- activity status is `published`.
- `registrationMode='member_self_register'`.
- registration deadline has not passed when configured.
- capacity is not exceeded when configured.

Self-registration must execute through a trusted server route or a narrowly validated rules path. The preferred Module D implementation is a trusted server route so capacity checks and future side effects remain atomic.

Members cannot mark their own attendance.

### Attendance authority

`mod`, `super_mod`, and `admin` may mark attendance for published/closed activities according to server state-transition rules.

Normal attendance transitions:

- missing/registered -> attended
- missing/registered -> absent
- missing/registered -> excused
- attended/absent/excused -> another attendance state only before the activity is closed

After closure, attendance correction requires `super_mod` or `admin` and must create an audit event. Any point impact is handled through compensating ledger entries.

## Point ledger

### `pointLedger/{entryId}`

Authoritative append-only score record.

Fields:

- `uid: string`
- `activityId: string | null`
- `participationId: string | null`
- `entryType: 'attendance' | 'bonus' | 'manual_adjustment' | 'reversal' | 'correction'`
- `points: number`
- `reason: string`
- `policyVersion: number | null`
- `sourceEntryId: string | null`
- `operationId: string`
- `createdBy: string`
- `createdAt: Timestamp`

Rules:

- normal attendance/bonus/manual entries use non-zero bounded integer points.
- reversal entries carry the exact opposite value of their referenced source entry.
- correction is represented as a compensating entry after a reversal when needed; original entries remain unchanged.
- ledger records are never browser writable.
- ledger records are not edited or deleted by normal ACC operations.

### Deterministic idempotency

Every privileged point mutation requires an `operationId` generated by the client/ACC action boundary and validated server-side.

The transaction derives a deterministic ledger key from the operation identity. Replaying the same operation returns the already-applied result without changing totals again.

A different operation that attempts to create a conflicting logical score for the same activity/member/score slot is rejected unless it is an authorized correction/reversal path.

### Point slots

To prevent accidental duplicate awards, normal score records use a logical slot:

- attendance: one slot per `{activityId, uid}`.
- bonus: one or more explicitly named bonus reasons, each with a stable server-normalized key.
- manual adjustment: unique operation-driven slot requiring elevated reason text.

Module D v1 keeps slot semantics simple and does not build a general rules engine.

## Member aggregate

### `memberStats/{uid}`

Server-owned projection for fast member/profile reads.

Fields:

- `uid: string`
- `totalPoints: number`
- `activityCount: number`
- `attendedCount: number`
- `recognitionCount: number`
- `lastActivityAt: Timestamp | null`
- `updatedAt: Timestamp`

`totalPoints` changes only from point-ledger transactions. It is never accepted from a public/ACC browser payload as authoritative input.

`memberStats` may be rebuilt from authoritative records by a future maintenance tool, but Module D does not add an automatic background reconciliation subsystem unless verification proves one is necessary.

## Transaction contract

A normal score operation updates atomically:

1. `pointLedger/{entryId}`.
2. `memberStats/{uid}`.
3. `activityParticipation/{activityId}__{uid}` when attendance state is part of the action.
4. `adminAudit/{operationId}` or an audit key derived from it.

The transaction must be retry-safe. If the exact operation already exists with matching immutable input, the server returns success/idempotent status without double-applying points.

If an existing operation key has different immutable input, the server returns conflict and does not partially update any record.

## Recognition model

### `recognitions/{recognitionId}`

Module D v1 uses manual recognition records. Automatic threshold-based awards are intentionally excluded.

Fields:

- `uid: string`
- `title: string`
- `reason: string`
- `activityId: string | null`
- `ledgerEntryId: string | null`
- `effectiveAt: Timestamp`
- `createdBy: string`
- `createdAt: Timestamp`
- `status: 'active' | 'revoked'`
- `revokedBy: string | null`
- `revokedAt: Timestamp | null`
- `revocationReason: string | null`

Only `super_mod` or `admin` may grant/revoke recognition in Module D v1. Revocation does not delete history.

Recognition count in `memberStats` is maintained transactionally by trusted server code.

## Authority matrix

### `member`

- read published activities.
- self-register where activity policy allows.
- read their own participation/point history and member stats.
- read recognitions intended for their profile/public club display.
- cannot mark attendance or write points/recognitions.

### `mod`

- read operational activity/attendance queues in ACC.
- mark attendance before closure.
- grant normal attendance points and bounded policy-approved bonus points.
- cannot change scoring policy after lock.
- cannot reverse ledger entries.
- cannot grant/revoke recognitions.

### `super_mod`

- all mod authority.
- correct attendance after closure with a reason.
- perform point reversals/corrections with a reason.
- grant/revoke recognitions.

### `admin`

- all super_mod authority.
- create/edit/publish/close/cancel activities.
- configure scoring policy before lock.
- resolve operational exceptions and perform authorized corrections.

ACC UI visibility is never treated as authorization. Server routes re-check role for each privileged request.

## ACC information architecture

Module D extends the existing authenticated ACC shell with focused routes rather than a monolithic screen:

- `/activities` — activity list, create/edit/publish/close/cancel.
- `/activities/[activityId]` — activity operations and policy snapshot.
- `/activities/[activityId]/attendance` — bounded attendance/registration table and scoring actions.
- `/points` — bounded point-ledger operational search/history.
- `/recognitions` — recognition management for super_mod/admin.

Existing `/members`, `/moderation`, `/verification`, `/audit`, `/system`, and Module C AI controls remain intact.

## ACC server API boundaries

Module D follows existing `admin-portal/app/api` patterns.

Expected route groups:

- `GET /api/activities`
- `POST /api/activities`
- `GET /api/activities/[activityId]`
- `PATCH /api/activities/[activityId]`
- `POST /api/activities/[activityId]/transition`
- `GET /api/activities/[activityId]/participation`
- `POST /api/activities/[activityId]/attendance`
- `POST /api/points/apply`
- `POST /api/points/reverse`
- `GET /api/points`
- `GET /api/recognitions`
- `POST /api/recognitions`
- `POST /api/recognitions/[recognitionId]/revoke`

Exact route decomposition may be simplified during implementation if an existing focused route pattern is safer, provided security/state/idempotency contracts are preserved.

Every privileged mutation endpoint must:

1. verify Firebase bearer ID token through Firebase Admin.
2. reject `mustChangePassword=true`.
3. enforce minimum role.
4. validate identifiers, numeric bounds, enums, timestamps, text lengths and state transition.
5. use Firestore transaction/batch semantics when multiple documents must remain consistent.
6. require/reuse `operationId` for retry-safe mutations.
7. create an append-only `adminAudit` event.
8. return sanitized errors without credentials, private data or stack internals.

## Public/member application

### Activity discovery

Existing published activity cards/details remain. Module D adds stable lifecycle-aware fields needed for registration, without exposing draft/admin-only metadata.

### Member self-registration

Published activities may expose a register/unregister control only when policy permits. Module D v1 may omit unregister after attendance has been marked or the deadline passes.

### Member activity and points history

Own profile receives bounded history views:

- participation history by activity.
- point-ledger history with human-readable reason and linked activity when available.
- aggregate total and activity counts from `memberStats/{uid}`.
- recognitions.

No client computes the authoritative total by summing an unbounded ledger.

For other members, only existing profile visibility rules plus explicitly public recognition/summary fields are exposed. Detailed point ledger is owner/privileged only unless a later product decision explicitly broadens it.

## Firestore security boundary

Public/ordinary client authority:

- published activity reads remain allowed according to existing rules.
- own safe member history reads may be allowed only for documents whose `uid == request.auth.uid` and only when product UI requires direct Firestore reads.
- no direct client writes to `pointLedger`, `memberStats`, `recognitions`, `adminAudit`, or privileged participation state.

Preferred implementation is server-brokered writes for registration and all privileged operations.

Unknown/unmatched Firestore paths remain default-deny.

Module D must not weaken Module A/B/C rules for roles, reports, verification, certificates, social posts, audit data or AI server-owned collections.

## Query and index strategy

Default page sizes are 20–30. Hard server maximum is 50.

Expected bounded query patterns:

- activities by status + start time.
- participation by activity + status/name lookup as supported by existing member data.
- participation by uid + updated/activity time.
- ledger by uid + createdAt desc.
- ledger by activityId + createdAt desc.
- recognition by uid + effectiveAt desc.
- ACC operational queues by status + updated/created time.

Only composite indexes proven necessary by implemented query shapes are added. No speculative index growth.

No full-collection realtime listener is allowed for participation or point ledger.

## Error handling and durable fallbacks

Expected stable error classes include:

- unauthenticated/forbidden.
- password rotation required.
- activity not found.
- invalid lifecycle transition.
- registration closed/capacity reached.
- scoring policy locked.
- duplicate/conflicting operation.
- point bounds violation.
- reversal source invalid/already reversed.
- Firestore transaction conflict/provider unavailable.

A failed multi-document mutation must leave no partial score/aggregate/audit state.

If a planned convenience feature cannot be implemented safely with current Firestore/Next.js/Firebase capabilities, Module D replaces it with a simpler server-controlled path rather than adding broad client permissions or legacy credentials.

## Testing strategy

Module D follows TDD. Tests are written RED before production implementation for each task.

Required test areas:

1. Activity lifecycle state machine and terminal-state rejection.
2. Scoring-policy lock behavior.
3. Deterministic participation IDs and duplicate prevention.
4. Member self-registration rules, deadline and capacity behavior.
5. Attendance authority by role and post-closure correction rules.
6. Point ledger append-only contract.
7. Operation-id idempotency and mismatched replay conflict.
8. Attendance/ledger/memberStats/audit transactional consistency.
9. Reversal/correction rules and double-reversal prevention.
10. Role matrix for mod/super_mod/admin.
11. `mustChangePassword` mutation gate.
12. Recognition grant/revoke authority and non-destructive history.
13. Browser/client denial for ledger/stats/audit/privileged writes.
14. Bounded pagination and index contract tests.
15. Public member activity/point history UI behavior.
16. ACC activity, attendance, points and recognition UI contracts.
17. Regression tests for Modules A, B and C, including Module C AI/security boundaries.
18. Production-boundary tests proving feature/release validation cannot become the production deployer.

## Release and production gates

Feature completion requires:

- full public test/typecheck/lint/build green.
- full ACC test/typecheck/lint/build green.
- security and release-readiness tests green.
- diff review confirms no private migration artifacts or credential fallbacks.
- no production deployment from feature branch.

Integration targets `release/v1.0` only through an exact-head guarded pull request.

After merge, the exact release merge SHA must pass post-merge CI. Any Android packaging workflow triggered by release is treated as an additional regression gate when it runs.

Production `main` remains unchanged until a separate production-promotion decision.

## Out of scope and forward compatibility

Module D intentionally does not implement notifications. It emits durable business state transitions that a later notification module can consume, including:

- activity published/changed.
- member registered.
- attendance recorded/corrected.
- points applied/reversed/corrected.
- recognition granted/revoked.

This makes Module D the event foundation for a future notification/engagement module without coupling score authority to messaging infrastructure.

## Completion definition

Module D is complete at the release/integration layer when:

- activity management, registration, attendance, points, member aggregates and recognitions operate through defined authorization boundaries.
- authoritative score history is append-only and correction-safe.
- aggregate totals remain transactionally consistent with successful ledger operations.
- member/public UI exposes bounded trustworthy history without client-authoritative totals.
- ACC exposes bounded operational workflows for permitted roles.
- all Module D and regression gates pass on the exact feature head.
- the exact merge commit on `release/v1.0` passes post-merge verification.
- `main` production baseline remains unchanged unless explicitly promoted later.
