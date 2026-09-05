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

The existing public activity service exposes only `activities` with `status='published'` and is read-only from the browser. Module D extends this behavior rather than replacing the public activity concept.

Published-only public discovery remains the default. Draft/closed management metadata, registration state, attendance, points, member aggregates, recognitions and audit data are server-brokered and remain outside ordinary client Firestore write authority.

## Product principles

### Ledger before mutable totals

`users/{uid}` must not become the source of truth for points. A mutable `totalPoints` field on a user profile would make corrections unauditable and vulnerable to drift.

Module D uses:

- `pointLedger/{entryId}` as the authoritative append-only score history.
- `memberStats/{uid}` as a server-owned aggregate projection for fast reads.

Every score-changing operation writes the ledger entry and aggregate change in one trusted transaction.

### Correct by compensation, never rewriting history

A bad score is corrected by adding a reversal and, when necessary, a replacement correction entry. Existing point ledger records are never edited or deleted during normal operations.

### Participation is not points

Attendance/participation state and points are related but independent facts. A member may attend and receive zero points, be absent/excused, withdraw before an activity, or receive an authorized score correction later.

`activityParticipation` stores participation lifecycle. `pointLedger` stores score history.

### Server authority for club operations

Ordinary browser clients never write attendance, ledger entries, member aggregates, recognitions, activity management state, or administrative audit events directly.

Public self-registration and member-history reads are brokered by authenticated Next.js server routes. Privileged operations execute through ACC server routes using Firebase Admin after bearer-token verification, password-rotation gate, RBAC validation, payload validation and state-transition checks.

### Bounded reads and explicit lifecycle

All operational queues use bounded cursor pagination. Activity, participation and score lifecycle states are explicit, not inferred from free-text fields or timestamps alone.

## Activity model

### `activities/{activityId}`

Canonical lifecycle:

- `draft`
- `published`
- `closed`
- `cancelled`

Required core fields:

- `title: string` — 1..160 trimmed characters.
- `description: string` — 0..10,000 characters.
- `startAt: Timestamp`.
- `endAt: Timestamp | null` — when present, must be `>= startAt`.
- `location: string` — 0..300 characters.
- `coverImageURL: string` — existing safe public image URL contract.
- `status: 'draft' | 'published' | 'closed' | 'cancelled'`.
- `createdBy: string`.
- `createdAt: Timestamp`.
- `updatedBy: string`.
- `updatedAt: Timestamp`.

Operational fields:

- `registrationMode: 'closed' | 'member_self_register'`.
- `registrationDeadline: Timestamp | null` — when present, must be `<= startAt`.
- `capacity: number | null` — integer 1..5000 when present.
- `registrationCount: number` — server-owned current count of `status='registered'` participation rows.
- `scoringPolicy: ActivityScoringPolicy`.
- `policyLockedAt: Timestamp | null`.
- `closedAt: Timestamp | null`.
- `cancelledAt: Timestamp | null`.
- `cancellationReason: string | null` — mandatory for cancellation, 1..1000 characters.

### `ActivityScoringPolicy`

Module D v1 stores a small explicit policy snapshot on the activity so score decisions remain interpretable later.

Fields:

- `attendancePoints: number` — integer 0..1000.
- `maxBonusPoints: number` — integer 0..1000.
- `notes: string` — 0..2000 characters.
- `version: 1`.

Module D does not evaluate arbitrary formulas and does not use AI to assign points.

### Activity lifecycle transitions

Allowed normal transitions:

- `draft -> published`
- `draft -> cancelled`
- `published -> closed`
- `published -> cancelled`

`closed` and `cancelled` are terminal for normal operations. An activity cannot be closed before `startAt`; a pre-start activity that will not occur must be cancelled.

Only `admin` may create activities or perform lifecycle transitions. `super_mod` and `mod` operate attendance/points but do not publish/cancel club activities.

### Edit contract

While `draft`, `admin` may edit all validated activity fields.

After publication and before `startAt`, `admin` may edit `title`, `description`, `endAt`, `location`, `coverImageURL`, `registrationMode`, `registrationDeadline` and `capacity`, subject to validation and audit. Capacity can never be set below `registrationCount`.

Scoring policy can be changed after publication only when all of these are true:

- current time is before `startAt`.
- `registrationCount == 0`.
- `policyLockedAt == null`.

The first successful registration, attendance operation or point operation atomically sets `policyLockedAt` if it is still null. At or after `startAt`, the server treats the policy as locked even if a legacy/malformed document has `policyLockedAt == null` and writes the lock timestamp on the next trusted mutation.

Once locked, scoring policy is immutable. Historical scoring errors are corrected through ledger compensation, never policy rewrites.

## Participation model

### `activityParticipation/{participationId}`

Global collection with deterministic document ID:

`{activityId}__{uid}`

Fields:

- `activityId: string`.
- `uid: string`.
- `status: 'registered' | 'withdrawn' | 'attended' | 'absent' | 'excused'`.
- `registeredAt: Timestamp | null`.
- `registeredBy: string | null`.
- `withdrawnAt: Timestamp | null`.
- `attendanceMarkedAt: Timestamp | null`.
- `attendanceMarkedBy: string | null`.
- `updatedAt: Timestamp`.

Deterministic IDs make the record unique per member/activity and prevent duplicate attendance rows.

### Member self-registration

A signed-in club member with `mustChangePassword=false` may self-register only through the public authenticated server route when:

- activity status is `published`.
- `registrationMode='member_self_register'`.
- current time is before `startAt`.
- current time is before or equal to `registrationDeadline` when configured.
- `registrationCount < capacity` when capacity is configured.

Registration executes in a Firestore transaction that reads the activity and deterministic participation row, checks capacity, writes/re-activates participation as `registered`, increments `registrationCount` exactly once, and locks scoring policy if needed.

Replay of registration for an already-registered member is idempotent and does not increment capacity again.

### Member withdrawal and re-registration

A member may withdraw only through the public server route when their state is `registered`, the activity is still `published`, and the same time/deadline conditions used for registration remain open. Withdrawal transitions `registered -> withdrawn` and decrements `registrationCount` transactionally.

A withdrawn member may re-register while registration remains open and capacity remains available. Re-registration transitions `withdrawn -> registered` and increments `registrationCount` once.

Members cannot withdraw or re-register after attendance has been marked.

### Attendance authority

`mod`, `super_mod`, and `admin` may mark attendance through ACC.

Normal pre-close transitions are:

- missing/registered/withdrawn -> attended
- missing/registered/withdrawn -> absent
- missing/registered/withdrawn -> excused
- attended/absent/excused -> another attendance state only when no point-ledger attendance slot has been awarded yet

When a transition leaves `registered`, the transaction decrements `registrationCount` once. Attendance states do not consume activity registration capacity after the activity starts.

If an attendance score has already been awarded, changing attendance requires `super_mod` or `admin` and must use the correction transaction described below so score history remains consistent.

After activity closure, every attendance correction requires `super_mod` or `admin`, a 1..1000 character reason, and an audit event.

## Point ledger

### `pointLedger/{entryId}`

Authoritative append-only score record.

Fields:

- `uid: string`.
- `activityId: string | null`.
- `participationId: string | null`.
- `entryType: 'attendance' | 'bonus' | 'manual_adjustment' | 'reversal' | 'correction'`.
- `points: number` — non-zero integer, absolute value <= 1000.
- `reason: string` — 1..1000 characters.
- `slotKey: string | null`.
- `policyVersion: number | null`.
- `sourceEntryId: string | null`.
- `operationId: string`.
- `createdBy: string`.
- `createdAt: Timestamp`.

Ledger records are never browser writable and are never edited/deleted by normal operations.

If `attendancePoints == 0`, marking a member attended creates no zero-value ledger entry. Attendance remains valid and `memberStats.activityCount` still reflects the attended state.

### Deterministic score slots

Normal score awards use deterministic immutable entry IDs so logical duplicates cannot be created under a different operation ID:

- attendance: `attendance__{activityId}__{uid}`.
- bonus: `bonus__{activityId}__{uid}__{bonusKey}` where `bonusKey` is a server-normalized 1..80 character stable key.
- manual adjustment: `adjustment__{operationId}`.

One attendance award and one award per bonus key are allowed for the same member/activity. A conflicting attempt is rejected; a byte-equivalent retry is idempotent.

### Point authority

`mod`, `super_mod`, and `admin` may apply the activity attendance award and bonus awards that satisfy the locked activity policy.

Bonus points must be positive integers and `<= scoringPolicy.maxBonusPoints` per bonus entry.

Only `super_mod` and `admin` may create `manual_adjustment`, `reversal`, or `correction` entries.

Manual adjustments are integer values from -1000..1000 excluding zero and require a reason.

### Reversal and correction

A reversal references one existing non-reversal ledger entry and carries exactly `-source.points`. A source entry can be reversed at most once.

A replacement correction, when needed, references the same original source lineage and records the new intended non-zero value. The server performs reversal and replacement in one Firestore transaction with member aggregate updates and audit.

Changing attendance after an attendance award exists uses this elevated correction path. The original attendance ledger entry remains immutable.

### Operation idempotency

Every privileged score mutation requires a client-generated `operationId` of 16..128 URL-safe characters.

`adminAudit/{operationId}` is also the idempotency receipt for the privileged mutation and stores an immutable request fingerprint in audit metadata. Replaying the same `operationId` with the same fingerprint returns the already-applied result. Reusing an operation ID with different immutable input returns conflict and changes nothing.

This reuses Module C's trusted append-only audit pattern instead of creating a second generic operation ledger.

## Member aggregate

### `memberStats/{uid}`

Server-owned projection for fast member/profile reads.

Fields:

- `uid: string`.
- `totalPoints: number` — signed safe integer, constrained to -2,000,000,000..2,000,000,000.
- `activityCount: number` — count of distinct participation rows currently in `status='attended'`.
- `recognitionCount: number` — count of active recognitions.
- `lastActivityAt: Timestamp | null` — latest `startAt` among currently attended activities as maintained by trusted operations where deterministically available.
- `updatedAt: Timestamp`.

`totalPoints` changes only from point-ledger transactions and is never accepted from browser payloads as authoritative input.

Attendance transitions update `activityCount` only when crossing into or out of `attended`. Replaying the same attendance state does not change the count.

If correcting `lastActivityAt` would require an unbounded scan after removing the current latest attendance, the mutation sets `lastActivityAt` to the newest value available from a bounded server query. `lastActivityAt` is a convenience projection; `activityCount` and ledger totals remain authoritative transactionally maintained projections.

## Transaction contracts

### Attendance transaction without existing score

Updates atomically:

1. `activityParticipation/{activityId}__{uid}`.
2. `activities/{activityId}.registrationCount` when leaving/entering `registered`.
3. `memberStats/{uid}.activityCount` when crossing attended state.
4. `adminAudit/{operationId}`.

### Score transaction

Updates atomically:

1. `pointLedger/{entryId}`.
2. `memberStats/{uid}.totalPoints`.
3. `adminAudit/{operationId}`.

### Attendance correction with score impact

Updates atomically:

1. participation state.
2. original score reversal ledger entry.
3. replacement correction ledger entry when the corrected state/value requires it.
4. member point aggregate.
5. member activity count when crossing attended state.
6. activity registration count when applicable.
7. audit receipt/event.

Every multi-document transaction is retry-safe. Fingerprint mismatch on an existing operation ID returns conflict with no partial updates.

## Recognition model

### `recognitions/{recognitionId}`

Module D v1 uses manual recognition records. Automatic threshold-based awards are intentionally excluded.

Fields:

- `uid: string`.
- `title: string` — 1..160 characters.
- `reason: string` — 1..2000 characters.
- `activityId: string | null`.
- `ledgerEntryId: string | null`.
- `effectiveAt: Timestamp`.
- `createdBy: string`.
- `createdAt: Timestamp`.
- `status: 'active' | 'revoked'`.
- `revokedBy: string | null`.
- `revokedAt: Timestamp | null`.
- `revocationReason: string | null`.

Only `super_mod` or `admin` may grant/revoke recognition. Revocation never deletes history.

Grant/revoke updates `memberStats.recognitionCount` and `adminAudit` transactionally.

Active recognitions are club-displayable through sanitized public/member server responses containing only `title`, `reason`, `effectiveAt`, and optional linked activity ID. Creator/revocation/audit metadata is never exposed on public profile surfaces.

## Authority matrix

### `member`

- read published activities.
- self-register, withdraw, and re-register while activity policy permits.
- read their own participation/point history and aggregate stats through authenticated public server APIs.
- read sanitized active recognitions shown by the club.
- cannot mark attendance or write points/recognitions.

### `mod`

- read operational activity/attendance queues in ACC.
- mark attendance before closure under the non-reversal rules above.
- grant the locked-policy attendance award and bounded bonus points.
- cannot change scoring policy.
- cannot create manual adjustments/reversals/corrections.
- cannot grant/revoke recognitions.

### `super_mod`

- all mod authority.
- correct attendance when score reversal is required or after closure.
- perform manual adjustments/reversals/corrections with reasons.
- grant/revoke recognitions.

### `admin`

- all super_mod authority.
- create/edit/publish/close/cancel activities.
- configure scoring policy before lock.
- resolve operational exceptions through the same audited correction mechanisms.

ACC UI visibility is never treated as authorization. Server routes re-check role for each privileged request.

## ACC information architecture

Module D extends the existing authenticated ACC shell with focused routes:

- `/activities` — activity list, create/edit/publish/close/cancel.
- `/activities/[activityId]` — activity operations and policy snapshot.
- `/activities/[activityId]/attendance` — bounded registration/attendance table and scoring actions.
- `/points` — bounded point-ledger operational search/history.
- `/recognitions` — recognition management for `super_mod`/`admin`.

Existing `/members`, `/moderation`, `/verification`, `/audit`, `/system`, and Module C AI controls remain intact.

## ACC server API boundaries

Module D follows existing `admin-portal/app/api` patterns.

Route groups:

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

Implementation may consolidate handlers behind shared service functions, but these logical API responsibilities and authorization boundaries cannot be weakened.

Every privileged mutation endpoint must:

1. verify Firebase bearer ID token through Firebase Admin.
2. reject `mustChangePassword=true`.
3. enforce minimum role.
4. validate identifiers, numeric bounds, enums, timestamps, text lengths and state transition.
5. use Firestore transactions when multiple documents must remain consistent.
6. require/reuse `operationId` for retry-safe privileged mutations.
7. create/use the append-only `adminAudit` idempotency receipt.
8. return sanitized errors without credentials, private data or stack internals.

## Public/member server API boundaries

The public Next.js application adds authenticated server routes that verify the member Firebase ID token and `mustChangePassword=false` before accessing private club-operation data:

- `POST /api/activities/[activityId]/registration` with action `register | withdraw`.
- `GET /api/me/activity-history`.
- `GET /api/me/points`.
- `GET /api/me/stats`.
- `GET /api/members/[uid]/recognitions` for sanitized active recognition display subject to existing profile visibility rules.

Own-history endpoints derive `uid` from the verified token; they do not accept another member UID from the client.

History endpoints use cursor pagination with default 20 and hard maximum 50.

## Public/member application

### Activity discovery

Existing published activity cards/details remain. Module D adds safe registration availability fields returned by the public server boundary without exposing draft/admin-only metadata.

### Registration UI

A published activity shows register/withdraw controls only when the server response reports the action is currently legal. Client UI state is advisory; the server re-validates deadline, capacity, activity status and participation state on every mutation.

### Member activity and points history

Own profile receives bounded history views:

- participation history by activity.
- point-ledger history with human-readable reason and linked activity when available.
- aggregate total/activity count from `memberStats/{uid}`.
- active recognitions.

No client computes the authoritative total by summing an unbounded ledger.

For other members, detailed participation/point history is never exposed in Module D. Existing profile visibility rules plus sanitized active recognitions are the only Module D additions to another member's public profile.

## Firestore security boundary

Direct public/browser Firestore authority remains deliberately narrow:

- published `activities` reads continue under the existing rule.
- no direct browser writes to `activities`, `activityParticipation`, `pointLedger`, `memberStats`, `recognitions`, or `adminAudit`.
- no direct browser reads of `activityParticipation`, `pointLedger`, `memberStats`, or full `recognitions`; private/sanitized access is server-brokered.
- unknown/unmatched Firestore paths remain default-deny.

Module D must not weaken Module A/B/C rules for roles, reports, verification, certificates, social posts, audit data or AI server-owned collections.

## Query and index strategy

Default page size is 20. Hard server maximum is 50.

Expected bounded query patterns:

- activities by `status + startAt`.
- participation by `activityId + status + updatedAt`.
- participation by `uid + updatedAt desc`.
- ledger by `uid + createdAt desc`.
- ledger by `activityId + createdAt desc`.
- recognition by `uid + effectiveAt desc`.
- ACC operational queues by lifecycle state + time.

Only composite indexes proven necessary by implemented query shapes are added. No speculative index growth.

No full-collection realtime listener is allowed for participation, ledger or recognitions.

## Error handling and durable fallbacks

Stable domain errors include:

- `UNAUTHENTICATED` / `FORBIDDEN`.
- `PASSWORD_ROTATION_REQUIRED`.
- `ACTIVITY_NOT_FOUND`.
- `INVALID_ACTIVITY_TRANSITION`.
- `REGISTRATION_CLOSED`.
- `CAPACITY_REACHED`.
- `POLICY_LOCKED`.
- `OPERATION_CONFLICT`.
- `POINT_BOUNDS_VIOLATION`.
- `REVERSAL_SOURCE_INVALID`.
- `ALREADY_REVERSED`.
- `TRANSACTION_CONFLICT`.

A failed multi-document mutation leaves no partial score/aggregate/audit state.

If a planned convenience feature cannot be implemented safely with current Firestore/Next.js/Firebase capabilities, Module D replaces it with a simpler server-controlled path rather than broadening client permissions, adding legacy credentials, or introducing a second data authority.

## Testing strategy

Module D follows TDD. Tests are written RED before production implementation for each task.

Required test areas:

1. Activity lifecycle state machine and terminal-state rejection.
2. Post-publication edit allow-list, capacity floor and scoring-policy lock behavior.
3. Deterministic participation IDs and duplicate prevention.
4. Registration/withdraw/re-register transaction semantics, deadlines and capacity.
5. Attendance authority by role, registration-count adjustment and attended-count projection.
6. Point ledger append-only contract and deterministic score slots.
7. Operation-ID audit fingerprint idempotency and mismatched replay conflict.
8. Attendance/ledger/memberStats/audit transactional consistency.
9. Reversal/correction rules and double-reversal prevention.
10. Role matrix for `mod`/`super_mod`/`admin`.
11. `mustChangePassword` mutation gate.
12. Recognition grant/revoke authority and non-destructive history.
13. Browser/client denial for private operations collections.
14. Bounded pagination and index contract tests.
15. Public self-registration and own history API contracts.
16. Public profile recognition sanitization.
17. ACC activity, attendance, points and recognition UI contracts.
18. Regression tests for Modules A, B and C, including Module C AI/security boundaries.
19. Production-boundary tests proving feature/release validation cannot become the production deployer.

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

## Forward compatibility

Module D intentionally does not implement notifications. It creates durable business transitions a later notification module can consume:

- activity published/changed.
- member registered/withdrawn.
- attendance recorded/corrected.
- points applied/reversed/corrected.
- recognition granted/revoked.

This makes Module D the event foundation for a future notification/engagement module without coupling score authority to messaging infrastructure.

## Completion definition

Module D is complete at the release/integration layer when:

- activity management, registration, attendance, points, member aggregates and recognitions operate through the defined authorization boundaries.
- authoritative score history is append-only and correction-safe.
- aggregate totals remain transactionally consistent with successful ledger/attendance operations.
- member/public UI exposes bounded trustworthy history without client-authoritative totals.
- ACC exposes bounded operational workflows for permitted roles.
- all Module D and A/B/C regression gates pass on the exact feature head.
- the exact merge commit on `release/v1.0` passes post-merge verification.
- `main` production baseline remains unchanged unless explicitly promoted later.
