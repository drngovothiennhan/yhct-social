# Beta 2.0 Module D Club Operations & Points Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement trusted club activity operations, member registration/attendance, append-only points, member aggregates/history, and manual recognitions without weakening existing production, RBAC, audit, or Firebase security boundaries.

**Architecture:** ACC owns privileged activity/attendance/points/recognition mutations through Firebase Admin server routes, using `adminAudit/{operationId}` as the retry/idempotency receipt and Firestore transactions for all multi-document state changes. Public members use bounded root Next.js server APIs for self-registration and their own history; `pointLedger` is authoritative, while `memberStats` is a server-owned read projection.

**Tech Stack:** Next.js App Router, TypeScript, React, Firebase Auth/Firestore/Admin, Vercel, Node test runner, ESLint.

**Spec:** `docs/superpowers/specs/2026-09-05-beta-2-module-d-club-operations-points-design.md`

## Global Constraints

- Base branch is `release/v1.0` at Module C integration baseline; implementation branch is `beta/2.0-module-d`.
- Production `main` remains outside feature/release implementation until an explicit production-promotion decision.
- Preserve `member < mod < super_mod < admin` and reject protected mutations when `mustChangePassword=true`.
- No service-account JSON, Firebase token fallback, client-side Admin SDK, or widened production WIF condition.
- `pointLedger` is append-only authoritative history; corrections use reversal/correction entries instead of editing history.
- `memberStats` is server-owned and never accepted from client payload as authoritative state.
- Point values are bounded non-zero integers with absolute value at most 1,000 per ledger entry.
- Every privileged mutation uses an `operationId`, trusted authorization, transactional state changes where needed, and append-only audit evidence.
- Members never mark their own attendance and never write points, recognitions, aggregates, or administrative audit records directly.
- Queries are bounded with hard server maximum 50; no unbounded participation/ledger listener.
- Existing Modules A/B/C, AI server-owned data, moderation, verification, certificate, migration and production deployment boundaries must remain green.

---

## Locked File Structure

### Shared/root application

- `lib/server/member-auth.ts` — reusable root bearer Firebase auth for non-AI member server APIs.
- `lib/server/club-operations/types.ts` — Zod-free/pure stable public types and validation constants usable by Node strip-types tests.
- `lib/server/club-operations/registration.ts` — member self-register/withdraw transaction logic.
- `lib/server/club-operations/history.ts` — bounded own stats/participation/ledger/recognition reads.
- `app/api/club/activities/[activityId]/registration/route.ts` — authenticated member register/withdraw API.
- `app/api/club/me/history/route.ts` — authenticated member history API.
- `lib/activity-service.ts` — extend public activity read model with registration-safe fields only.
- `components/portal/activity-screens.tsx` — register/withdraw UX on activity detail.
- `components/portal/member-club-history.tsx` — own point/activity/recognition history panel.
- existing own-profile screen — mount history panel without broadening other-member visibility.

### ACC

- `admin-portal/lib/activity-policy.ts` — activity lifecycle, scoring policy, point/operation validation.
- `admin-portal/lib/activity-operations.ts` — trusted activity create/update/transition/list/detail service.
- `admin-portal/lib/participation.ts` — bounded participation reads and attendance state transitions.
- `admin-portal/lib/points-ledger.ts` — atomic ledger/memberStats/participation/audit mutations and reversal/correction logic.
- `admin-portal/lib/recognitions.ts` — recognition grant/revoke transaction logic.
- `admin-portal/lib/audit.ts` — extend target types for `activity`, `participation`, `points`, `recognition`.
- `admin-portal/app/api/activities/**` — activity/list/detail/transition/attendance routes.
- `admin-portal/app/api/points/**` — point apply/reverse/list routes.
- `admin-portal/app/api/recognitions/**` — list/grant/revoke routes.
- `admin-portal/app/activities/**` — ACC activity management UI.
- `admin-portal/app/points/page.tsx` — bounded ledger UI.
- `admin-portal/app/recognitions/page.tsx` — manual recognition UI.
- `admin-portal/app/acc-shell.tsx` — add Module D destinations while preserving existing modules.

### Firebase/tests/docs

- `firestore.rules` — keep server-owned collections client-denied; allow only safe published activity reads already required by public UI.
- `firestore.indexes.json` — add only composites proven by actual Module D queries.
- `tests-node/module-d-*.test.mjs` — root/public contracts.
- `admin-portal/tests/module-d-*.test.mjs` — ACC domain/service/API/UI contracts.
- `README.md` — Module D operations/security/recovery documentation.

---

### Task 1: Domain Contracts, Lifecycle State Machine, and Reusable Root Member Auth

**Files:**
- Create: `lib/server/member-auth.ts`
- Create: `lib/server/club-operations/types.ts`
- Create: `admin-portal/lib/activity-policy.ts`
- Modify: `admin-portal/lib/audit.ts`
- Test: `tests-node/module-d-member-auth-contract.test.mjs`
- Test: `admin-portal/tests/module-d-activity-policy.test.mjs`

**Interfaces:**
- Produces `requireClubMember(request: Request): Promise<ClubMemberActor>` where `ClubMemberActor = { uid: string; role: 'member'|'mod'|'super_mod'|'admin'; clubMember: true; mustChangePassword: false }`.
- Produces `assertActivityTransition(from, to): void`.
- Produces `validateScoringPolicy(input): ActivityScoringPolicy`.
- Produces `validateOperationId(value): string`, `validatePointValue(value): number`, `validateReason(value, max?): string`.
- Extends `AuditTargetType` with `activity | participation | points | recognition`.

- [ ] **Step 1: Write RED lifecycle/validation tests**

Create `admin-portal/tests/module-d-activity-policy.test.mjs` with explicit legal and illegal transitions:

```js
assert.doesNotThrow(() => assertActivityTransition('draft', 'published'));
assert.doesNotThrow(() => assertActivityTransition('published', 'closed'));
assert.throws(() => assertActivityTransition('closed', 'published'), /ACTIVITY_TRANSITION_INVALID/);
assert.equal(validatePointValue(1000), 1000);
assert.equal(validatePointValue(-1000), -1000);
assert.throws(() => validatePointValue(0), /POINT_VALUE_INVALID/);
assert.throws(() => validatePointValue(1001), /POINT_VALUE_INVALID/);
```

Also verify policy values are integers, `attendancePoints >= 0`, `maxBonusPoints >= 0`, each `<= 1000`, and notes are trimmed/bounded.

- [ ] **Step 2: Write RED root member-auth source contract**

Require `lib/server/member-auth.ts` to verify bearer tokens using existing root Firebase Admin, normalize legacy `moderator` to `mod`, reject non-club users, and reject `mustChangePassword=true`. Assert no `NEXT_PUBLIC`/credential fallback strings.

- [ ] **Step 3: Run RED tests**

Run:

```bash
node --experimental-strip-types --test admin-portal/tests/module-d-activity-policy.test.mjs tests-node/module-d-member-auth-contract.test.mjs
```

Expected: FAIL because Module D files do not exist.

- [ ] **Step 4: Implement pure policy and member auth**

Use explicit transition table:

```ts
const transitions = {
  draft: new Set(['published', 'cancelled']),
  published: new Set(['closed', 'cancelled']),
  closed: new Set<string>(),
  cancelled: new Set<string>(),
};
```

`requireClubMember()` must call `rootAdminAuth().verifyIdToken(token, true)` and return stable error codes `CLUB_AUTH_REQUIRED`, `CLUB_AUTH_INVALID`, `CLUB_MEMBERSHIP_REQUIRED`, `PASSWORD_ROTATION_REQUIRED`.

- [ ] **Step 5: Run Task 1 tests + typecheck**

Run:

```bash
node --experimental-strip-types --test admin-portal/tests/module-d-activity-policy.test.mjs tests-node/module-d-member-auth-contract.test.mjs && npm run typecheck && cd admin-portal && npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add lib/server/member-auth.ts lib/server/club-operations/types.ts admin-portal/lib/activity-policy.ts admin-portal/lib/audit.ts tests-node/module-d-member-auth-contract.test.mjs admin-portal/tests/module-d-activity-policy.test.mjs
git commit -m "feat(module-d): add club operations domain contracts"
```

---

### Task 2: ACC Activity Lifecycle Service and APIs

**Files:**
- Create: `admin-portal/lib/activity-operations.ts`
- Create: `admin-portal/app/api/activities/route.ts`
- Create: `admin-portal/app/api/activities/[activityId]/route.ts`
- Create: `admin-portal/app/api/activities/[activityId]/transition/route.ts`
- Test: `admin-portal/tests/module-d-activity-operations.test.mjs`
- Test: `admin-portal/tests/module-d-activity-api-contract.test.mjs`

**Interfaces:**
- Consumes Task 1 validators and existing `requireAccRole`, `adminDb`, `buildAuditEvent`.
- Produces `createActivity(input, actor, operationId): Promise<{ id:string; replayed:boolean }>`.
- Produces `updateDraftActivity(activityId, patch, actor, operationId)`.
- Produces `transitionActivity(activityId, targetStatus, reason, actor, operationId)`.
- Produces `listActivities({ status?, limit?, cursor? })` hard-capped at 50.

- [ ] **Step 1: Write RED create/lifecycle transaction tests**

Inject/fake transaction dependencies so tests prove:

- create requires admin;
- initial status is `draft`;
- create writes matching `adminAudit/{operationId}`;
- replay of the same audit operation returns `{ replayed:true }`;
- conflicting reuse of an operation ID returns `OPERATION_CONFLICT`;
- publish sets `policyLockedAt` only when `startAt <= now` would otherwise make later safe lock impossible; otherwise policy remains editable until start;
- close/cancel are terminal.

- [ ] **Step 2: Run RED tests**

Run:

```bash
cd admin-portal && node --experimental-strip-types --test tests/module-d-activity-operations.test.mjs tests/module-d-activity-api-contract.test.mjs
```

Expected: FAIL because service/routes do not exist.

- [ ] **Step 3: Implement activity service with idempotency receipt**

For every mutation transaction:

```ts
const auditRef = db.doc(`adminAudit/${operationId}`);
const existingAudit = await transaction.get(auditRef);
if (existingAudit.exists) {
  const recorded = existingAudit.data();
  // Return replay only when immutable action/target matches.
  // Otherwise throw OPERATION_CONFLICT.
}
```

Create/update/transition writes sanitized before/after audit snapshots. Never accept `createdBy`, timestamps, counters or status-transition side effects from request payload.

- [ ] **Step 4: Implement ACC routes**

Role rules:

- list/detail: minimum `mod`;
- create/update/transition: `admin` only.

All mutation routes require `operationId`. Map known domain errors to bounded HTTP statuses and use existing `accErrorResponse` for unexpected failures.

- [ ] **Step 5: Run Task 2 tests/typecheck**

Run:

```bash
cd admin-portal && node --experimental-strip-types --test tests/module-d-activity-operations.test.mjs tests/module-d-activity-api-contract.test.mjs && npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add admin-portal/lib/activity-operations.ts admin-portal/app/api/activities admin-portal/tests/module-d-activity-operations.test.mjs admin-portal/tests/module-d-activity-api-contract.test.mjs
git commit -m "feat(module-d): add ACC activity lifecycle"
```

---

### Task 3: Member Self-Registration, Withdrawal, and Capacity-Safe Transactions

**Files:**
- Create: `lib/server/club-operations/registration.ts`
- Create: `app/api/club/activities/[activityId]/registration/route.ts`
- Modify: `lib/activity-service.ts`
- Test: `tests-node/module-d-registration.test.mjs`
- Test: `tests-node/module-d-registration-route-contract.test.mjs`

**Interfaces:**
- Consumes `requireClubMember` and root `rootAdminDb()`.
- Produces `registerForActivity(activityId, actor, operationId)`.
- Produces `withdrawFromActivity(activityId, actor, operationId)`.
- Activity public model adds safe fields: `registrationMode`, `registrationDeadline`, `capacity`, `registrationCount`.

- [ ] **Step 1: Write RED registration state tests**

Cover:

- only `published` activities;
- `registrationMode === 'member_self_register'`;
- deadline rejection;
- capacity rejection;
- deterministic participation ID `${activityId}__${uid}`;
- registration count increments only on transition into `registered`;
- withdrawal decrements only from `registered`;
- withdrawal preserves document with `status:'withdrawn'`;
- re-register from `withdrawn` is allowed before deadline/capacity;
- attended/absent/excused cannot be withdrawn by member;
- repeated same `operationId` is idempotent.

- [ ] **Step 2: Run RED registration tests**

Run:

```bash
node --experimental-strip-types --test tests-node/module-d-registration.test.mjs tests-node/module-d-registration-route-contract.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Implement transaction-safe capacity logic**

Transaction reads `activity` and participation record, validates current state, computes new `registrationCount`, and writes both atomically. Reject negative counts and `count >= capacity` for new/re-register operations.

Use a server-owned operation receipt document under a dedicated collection such as `clubOperationReceipts/{operationId}` for member mutations, because `adminAudit` is reserved for privileged ACC operations. Receipt stores only `operationId`, actor UID, action, target ID, immutable request fingerprint and server timestamp.

- [ ] **Step 4: Implement member registration route**

`POST` body:

```json
{ "action": "register", "operationId": "uuid-or-stable-client-operation" }
```

or `action:'withdraw'`. Authenticate with `requireClubMember`; ignore any UID supplied by caller.

- [ ] **Step 5: Extend public activity read model**

Expose only registration-safe fields to public UI. Do not expose internal audit/policy control metadata beyond values required to render whether registration is open.

- [ ] **Step 6: Run Task 3 root gate**

Run:

```bash
node --experimental-strip-types --test tests-node/module-d-registration.test.mjs tests-node/module-d-registration-route-contract.test.mjs && npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add lib/server/club-operations/registration.ts app/api/club/activities lib/activity-service.ts tests-node/module-d-registration.test.mjs tests-node/module-d-registration-route-contract.test.mjs
git commit -m "feat(module-d): add capacity-safe member registration"
```

---

### Task 4: Participation, Attendance, Atomic Point Ledger, and MemberStats

**Files:**
- Create: `admin-portal/lib/participation.ts`
- Create: `admin-portal/lib/points-ledger.ts`
- Create: `admin-portal/app/api/activities/[activityId]/participation/route.ts`
- Create: `admin-portal/app/api/activities/[activityId]/attendance/route.ts`
- Create: `admin-portal/app/api/points/apply/route.ts`
- Test: `admin-portal/tests/module-d-participation.test.mjs`
- Test: `admin-portal/tests/module-d-points-ledger.test.mjs`

**Interfaces:**
- Produces `listParticipation(activityId, { status?, limit?, cursor? })`, max 50.
- Produces `applyAttendanceAndPoints(input, actor)` transaction.
- Produces `applyPointEntry(input, actor)` for policy-approved bonus/manual operations.
- Ledger entry types: `attendance | bonus | manual_adjustment | reversal | correction`.

- [ ] **Step 1: Write RED atomicity/idempotency tests**

Use fake transaction objects to prove one normal attendance operation writes atomically:

1. `activityParticipation/{activityId}__{uid}`.
2. deterministic `pointLedger/{entryId}`.
3. `memberStats/{uid}` total and attendance counters.
4. `adminAudit/{operationId}`.

Tests must prove duplicate operation replay does not increment points twice.

- [ ] **Step 2: Write RED authority/state tests**

- `mod+` may mark attendance before close;
- post-close attendance corrections require `super_mod+`;
- members cannot use ACC routes;
- attendance point amount comes from locked activity policy, not request payload;
- bonus cannot exceed activity `maxBonusPoints`;
- manual adjustments require `super_mod+` and reason;
- policy lock/start rules reject mutable policy scoring after start.

- [ ] **Step 3: Run RED tests**

Run:

```bash
cd admin-portal && node --experimental-strip-types --test tests/module-d-participation.test.mjs tests/module-d-points-ledger.test.mjs
```

Expected: FAIL.

- [ ] **Step 4: Implement ledger/memberStats transaction core**

Deterministic entry key examples:

- attendance: `attendance__${activityId}__${uid}` for first award;
- bonus: `bonus__${activityId}__${uid}__${normalizedBonusKey}`;
- manual/correction/reversal: key derived from `operationId`.

Before applying, read the relevant audit/ledger slot and reject logical duplicates. `memberStats.totalPoints` changes by exact ledger delta only. Use `FieldValue.increment` only inside the same Firestore transaction and never from client input.

- [ ] **Step 5: Implement participation and point APIs**

`attendance` route minimum role `mod`; `points/apply` selects minimum role by entry type. Validate all IDs/text/point bounds and reject request-supplied actor/timestamps/aggregate totals.

- [ ] **Step 6: Run Task 4 ACC gate**

Run:

```bash
cd admin-portal && node --experimental-strip-types --test tests/module-d-participation.test.mjs tests/module-d-points-ledger.test.mjs && npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add admin-portal/lib/participation.ts admin-portal/lib/points-ledger.ts admin-portal/app/api/activities admin-portal/app/api/points/apply admin-portal/tests/module-d-participation.test.mjs admin-portal/tests/module-d-points-ledger.test.mjs
git commit -m "feat(module-d): add attendance and append-only points ledger"
```

---

### Task 5: Point Reversal/Correction and Bounded Ledger Queries

**Files:**
- Modify: `admin-portal/lib/points-ledger.ts`
- Create: `admin-portal/app/api/points/reverse/route.ts`
- Create: `admin-portal/app/api/points/route.ts`
- Test: `admin-portal/tests/module-d-points-reversal.test.mjs`
- Test: `admin-portal/tests/module-d-points-query.test.mjs`

**Interfaces:**
- Produces `reversePointEntry(sourceEntryId, reason, actor, operationId)`.
- Produces `correctPointEntry(sourceEntryId, correctedPoints, reason, actor, operationId)` as reversal + correction in one transaction.
- Produces `listPointLedger({ uid?, activityId?, limit?, cursor? })`, max 50.

- [ ] **Step 1: Write RED reversal tests**

Prove:

- only `super_mod|admin` can reverse/correct;
- source entry must exist and cannot itself be an already-consumed reversal target;
- reversal points are exact `-source.points` regardless of caller payload;
- original entry remains unchanged;
- second independent reversal of same source is rejected;
- same operation replay is idempotent;
- aggregate total exactly compensates source.

- [ ] **Step 2: Write RED query-bound tests**

Assert max limit 50, cursor-based query assembly, no unbounded `.get()` on entire ledger, and only supported filters `uid` or `activityId` plus `createdAt desc`.

- [ ] **Step 3: Implement reversal/correction transaction**

Correction transaction creates both reversal and correction entries plus one audit receipt atomically. `correctedPoints` must be non-zero bounded integer and represents the desired replacement value, not a delta guessed by client.

- [ ] **Step 4: Implement bounded point routes**

`GET /api/points` minimum `mod`. `POST /api/points/reverse` requires `super_mod`; accepts `mode:'reverse'|'correct'`, source entry, optional corrected value, reason, operationId.

- [ ] **Step 5: Run Task 5 tests**

Run:

```bash
cd admin-portal && node --experimental-strip-types --test tests/module-d-points-reversal.test.mjs tests/module-d-points-query.test.mjs && npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```bash
git add admin-portal/lib/points-ledger.ts admin-portal/app/api/points admin-portal/tests/module-d-points-reversal.test.mjs admin-portal/tests/module-d-points-query.test.mjs
git commit -m "feat(module-d): add point corrections and bounded ledger queries"
```

---

### Task 6: Manual Recognition Grant/Revoke

**Files:**
- Create: `admin-portal/lib/recognitions.ts`
- Create: `admin-portal/app/api/recognitions/route.ts`
- Create: `admin-portal/app/api/recognitions/[recognitionId]/revoke/route.ts`
- Test: `admin-portal/tests/module-d-recognitions.test.mjs`

**Interfaces:**
- Produces `grantRecognition(input, actor, operationId)`.
- Produces `revokeRecognition(recognitionId, reason, actor, operationId)`.
- Produces `listRecognitions({ uid?, status?, limit?, cursor? })`, max 50.

- [ ] **Step 1: Write RED recognition tests**

Verify:

- grant/revoke requires `super_mod+`;
- grant validates target user and optional activity/ledger references;
- grant creates active recognition + increments `memberStats.recognitionCount` + audit atomically;
- revoke changes status to `revoked`, preserves original record, decrements count once, records revocation reason/actor/time + audit;
- replay is idempotent; already revoked with a new operation is conflict.

- [ ] **Step 2: Run RED recognition test**

Run:

```bash
cd admin-portal && node --experimental-strip-types --test tests/module-d-recognitions.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Implement recognition service/routes**

Use deterministic operation receipt via `adminAudit/{operationId}`. Recognition document ID may be generated server-side once per operation and recorded in audit target ID so replay can return the same result.

- [ ] **Step 4: Run Task 6 gate**

Run:

```bash
cd admin-portal && node --experimental-strip-types --test tests/module-d-recognitions.test.mjs && npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

```bash
git add admin-portal/lib/recognitions.ts admin-portal/app/api/recognitions admin-portal/tests/module-d-recognitions.test.mjs
git commit -m "feat(module-d): add auditable member recognitions"
```

---

### Task 7: Member History API and Public Activity Registration/History UX

**Files:**
- Create: `lib/server/club-operations/history.ts`
- Create: `app/api/club/me/history/route.ts`
- Modify: `components/portal/activity-screens.tsx`
- Create: `components/portal/member-club-history.tsx`
- Modify: existing own-profile screen file discovered on branch before implementation.
- Test: `tests-node/module-d-member-history.test.mjs`
- Test: `tests-node/module-d-public-ui-contract.test.mjs`

**Interfaces:**
- Produces `loadOwnClubHistory(uid, { limit?, cursor? })` returning `{ stats, participation, ledger, recognitions }` with each list bounded.
- Public registration UI calls only `/api/club/activities/[activityId]/registration` using current Firebase ID token.
- Own-profile history calls only `/api/club/me/history`; no direct client point-ledger write/read authority is introduced.

- [ ] **Step 1: Write RED member-history privacy tests**

Verify requested UID is always token UID, detailed ledger endpoint has no arbitrary `uid` body/query override, lists are max 30 by default/max 50 server-side, and missing `memberStats` returns zeroed projection without inventing ledger entries.

- [ ] **Step 2: Write RED UI contracts**

Assert activity detail exposes registration controls only for published/self-register activities and uses server API. Assert `member-club-history.tsx` renders total points, participation, point reasons and recognitions, but contains no Firestore write calls and no aggregate summation from an unbounded ledger.

- [ ] **Step 3: Implement own-history service/API**

Use root Admin server reads, ordered/limited queries, and sanitized DTOs. Never expose `createdBy` UID/audit internals when not needed by member UI.

- [ ] **Step 4: Implement registration UX**

Use authenticated ID token, generated client operation ID, optimistic button disable only, then reload safe activity/registration state. Provider/server failure shows bounded error and does not break activity detail or related posts.

- [ ] **Step 5: Implement own-profile history panel**

Mount only in own-profile flow. Other-member profiles retain existing visibility and receive no detailed ledger.

- [ ] **Step 6: Run Task 7 root gate**

Run:

```bash
node --experimental-strip-types --test tests-node/module-d-member-history.test.mjs tests-node/module-d-public-ui-contract.test.mjs && npm run typecheck && npm run lint && npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit Task 7**

```bash
git add lib/server/club-operations/history.ts app/api/club/me/history components/portal/activity-screens.tsx components/portal/member-club-history.tsx app components tests-node/module-d-member-history.test.mjs tests-node/module-d-public-ui-contract.test.mjs
git commit -m "feat(module-d): add member activity and points experience"
```

---

### Task 8: ACC Activities, Attendance, Points, and Recognition UI

**Files:**
- Create: `admin-portal/app/activities/page.tsx`
- Create: `admin-portal/app/activities/[activityId]/page.tsx`
- Create: `admin-portal/app/activities/[activityId]/attendance/page.tsx`
- Create: `admin-portal/app/components/activity-control-center.tsx`
- Create: `admin-portal/app/components/attendance-control.tsx`
- Create: `admin-portal/app/points/page.tsx`
- Create: `admin-portal/app/components/points-control.tsx`
- Create: `admin-portal/app/recognitions/page.tsx`
- Create: `admin-portal/app/components/recognitions-control.tsx`
- Modify: `admin-portal/app/acc-shell.tsx`
- Test: `admin-portal/tests/module-d-ui-contract.test.mjs`

**Interfaces:**
- Reuses existing ACC bearer API client/session patterns.
- Every mutation generates/reuses an `operationId` for the exact button action and disables duplicate submission while in flight.
- UI never computes authoritative totals or treats hidden buttons as authorization.

- [ ] **Step 1: Write RED ACC UI/nav contracts**

Assert nav includes `Hoạt động`, `Điểm`, `Khen thưởng` while retaining Members/Moderation/Verification/AI/Audit/System. Assert activity UI exposes draft/publish/close/cancel flows, attendance table is bounded, point correction actions are gated in UI to `super_mod+`, recognition actions likewise.

- [ ] **Step 2: Run RED UI tests**

Run:

```bash
cd admin-portal && node --experimental-strip-types --test tests/module-d-ui-contract.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Implement focused ACC screens**

Use route-level components instead of one monolith. The screens call only Module D server APIs; no direct Firebase Admin/browser writes. Show sanitized API errors and replay success normally.

- [ ] **Step 4: Preserve existing ACC shell behavior**

Update heading from fixed `Module C` wording to neutral `YHCT Social · Beta 2.0` and add Module D links without removing AI/moderation/system routes.

- [ ] **Step 5: Run Task 8 ACC gate**

Run:

```bash
cd admin-portal && node --experimental-strip-types --test tests/module-d-ui-contract.test.mjs && npm run typecheck && npm run lint && npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit Task 8**

```bash
git add admin-portal/app/activities admin-portal/app/points admin-portal/app/recognitions admin-portal/app/components admin-portal/app/acc-shell.tsx admin-portal/tests/module-d-ui-contract.test.mjs
git commit -m "feat(module-d): add ACC club operations workspace"
```

---

### Task 9: Firestore Rules, Query Indexes, and Cross-Module Security Contracts

**Files:**
- Modify only if required by actual access: `firestore.rules`
- Modify only for proven composite queries: `firestore.indexes.json`
- Test: `tests-node/module-d-rules-contract.test.mjs`
- Test: `tests-node/module-d-security-boundary.test.mjs`

**Interfaces:**
- Server-owned collections include `pointLedger`, `memberStats`, `recognitions`, `clubOperationReceipts`; privileged participation writes remain server-brokered.
- Existing catch-all default deny remains authoritative for unknown paths.

- [ ] **Step 1: Write RED/semantic rules contracts**

Tests must verify either explicit collection rules deny direct client writes or the collection remains protected by authoritative catch-all `allow read, write: if false`. No test should force redundant explicit rules when default deny already provides the intended security.

Also assert Module D source does not introduce:

```text
NEXT_PUBLIC_*ADMIN*
FIREBASE_TOKEN
credentials_json
GCP_SERVICE_ACCOUNT_JSON
serviceAccountKey
```

- [ ] **Step 2: Determine actual composite indexes from implemented queries**

Add only if code actually issues composite combinations, expected candidates:

- `activities(status ASC, startAt DESC)`;
- `activityParticipation(activityId ASC, status ASC, updatedAt DESC)` only if status filter is implemented;
- `pointLedger(uid ASC, createdAt DESC)`;
- `pointLedger(activityId ASC, createdAt DESC)`;
- `recognitions(uid ASC, effectiveAt DESC)`.

Do not add indexes for query shapes absent from production code.

- [ ] **Step 3: Run security/rules tests plus existing regression suite**

Run:

```bash
node --experimental-strip-types --test tests-node/module-d-rules-contract.test.mjs tests-node/module-d-security-boundary.test.mjs && npm test
```

Expected: PASS.

- [ ] **Step 4: Commit Task 9**

```bash
git add firestore.rules firestore.indexes.json tests-node/module-d-rules-contract.test.mjs tests-node/module-d-security-boundary.test.mjs
git commit -m "security(module-d): lock club operations data boundaries"
```

---

### Task 10: Full Regression, Release Readiness, PR Integration, and Post-Merge Verification

**Files:**
- Create: `tests-node/module-d-release-readiness.test.mjs`
- Modify: `README.md`
- Modify CI workflows only if existing paths do not already run Module D tests; production deployment workflow must not be widened.

**Interfaces:**
- Produces a feature branch safe to merge into `release/v1.0` only.
- Does not promote production `main`, run migration/import, or change production credentials/WIF.

- [ ] **Step 1: Write release-readiness contract**

Scan Module D production files for `TODO`, `TBD`, debug logging, credential material and accidental direct client writes to server-owned collections. Verify production deploy workflow remains `main`-only and no Module D feature/release branch is added to production WIF/deploy authentication.

- [ ] **Step 2: Run complete root gate**

Run:

```bash
npm test && npm run typecheck && npm run lint && npm run build
```

Expected: PASS.

- [ ] **Step 3: Run complete ACC gate**

Run:

```bash
cd admin-portal && npm test && npm run typecheck && npm run lint && npm run build
```

Expected: PASS.

- [ ] **Step 4: Compare feature branch with `release/v1.0`**

Confirm changes are limited to Module D source/tests/docs/config/indexes. Explicitly verify no migration workflow/script/private migration package/certificate evidence/production deploy credential material changed.

- [ ] **Step 5: Update README**

Document activity lifecycle, registration/withdraw rules, capacity behavior, attendance authority, point ledger/reversal model, recognition roles, member history privacy, idempotency receipts, degraded/error behavior and local verification commands.

- [ ] **Step 6: Commit readiness state**

```bash
git add README.md tests-node/module-d-release-readiness.test.mjs .github/workflows
git commit -m "docs(module-d): document club operations and release gates"
```

- [ ] **Step 7: Verify exact feature head in GitHub Actions**

Required on exact head SHA:

- public test/typecheck/lint/build success;
- ACC test/typecheck/lint/build success;
- Android packaging success when automatically triggered for the relevant branch/build path;
- no production Firebase deployment/authentication from Module D feature branch.

- [ ] **Step 8: Create/ready PR to `release/v1.0` and merge with exact-head guard**

PR body records exact head SHA, CI run IDs, security substitutions and production isolation. Merge only if mergeable and exact-head validation is green.

- [ ] **Step 9: Verify exact release merge SHA**

On `release/v1.0`, require post-merge public+ACC CI green. If Android packaging is triggered on release, require it green as an additional client regression gate. Confirm `main` SHA is unchanged and no production deploy run occurred.

- [ ] **Step 10: Module D completion checklist**

Do not mark Module D complete unless all are evidenced:

1. Activity lifecycle/admin operations.
2. Capacity-safe member registration/withdrawal.
3. Moderator attendance with post-close elevated correction boundary.
4. Append-only authoritative point ledger.
5. Atomic `memberStats` aggregate updates.
6. Idempotent reversal/correction paths.
7. Manual recognition grant/revoke.
8. Owner-only detailed history UX/API.
9. ACC operational UI and bounded queues.
10. Security/index/release gates and production isolation.
