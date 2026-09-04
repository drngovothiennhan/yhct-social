# YHCT Social Beta 2.0 Module C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-safe Admin & Moderation Control Plane with member reports, moderation queue/actions, practitioner verification, append-only audit history, and a decomposed ACC UI.

**Architecture:** Public clients may create only their own reports and verification requests under Firestore/Storage Rules. All privileged moderation, verification decisions, account/system changes, and audit writes flow through authenticated ACC server routes using Firebase Admin, shared role/state-transition helpers, Firestore transactions, and retry-safe operation IDs. ACC remains a separate Next.js deployment; production WIF remains main-only.

**Tech Stack:** Next.js App Router, TypeScript, React, Firebase Auth, Firestore, Firebase Storage, Firebase Admin SDK, Node test runner, Vercel, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-05-beta-2-module-c-admin-moderation-design.md`

## Global Constraints

- Production baseline is `031a347499ea29330f800c0254437337a46376e0`; feature work stays on `beta/2.0-module-c` until release gates pass.
- Preserve role hierarchy `member < mod < super_mod < admin` and mandatory password rotation.
- Do not widen the existing production main-only WIF provider condition.
- No service-account JSON, activation passwords, private roster, ID tokens, private certificate URLs, or secrets in repository/build output/audit snapshots.
- Normal moderation uses `active | hidden | deleted`; restore is `super_mod/admin` only.
- Report details limit is exactly 2,000 characters.
- Verification approval/rejection is `super_mod/admin` only; client can never set `verified` or decision metadata.
- `adminAudit` is server-authored append-only and retry-safe through `operationId`.
- Public app and ACC remain separate Vercel applications sharing the existing Firebase project.
- Every implementation task follows RED -> minimal GREEN -> refactor -> regression verification.

---

### Task 1: Module C domain contracts and Firestore security model

**Files:**
- Create: `lib/domain/report.ts`
- Create: `lib/report-service.ts`
- Modify: `lib/types.ts`
- Modify: `firestore.rules`
- Modify: `firestore.indexes.json`
- Test: `tests-node/module-c-report-domain.test.mjs`
- Test: `tests-node/module-c-rules-contract.test.mjs`

**Interfaces:**
- Produces: `REPORT_REASON_CODES`, `buildReportId(input)`, `validateReportDraft(input)`, `createReport(input)`.
- `buildReportId({ reporterUid, targetType, postId, commentId }) -> string` returns `post__{postId}__{reporterUid}` or `comment__{postId}__{commentId}__{reporterUid}`.
- Firestore report create contract requires self reporter, `status='open'`, empty moderator-owned fields, and <= 2000 detail characters.

- [ ] **Step 1: Write RED domain and rules contract tests**

```js
assert.equal(buildReportId({ reporterUid: 'u1', targetType: 'post', postId: 'p1', commentId: null }), 'post__p1__u1');
assert.throws(() => validateReportDraft({ reasonCode: 'spam', details: 'x'.repeat(2001) }), /2000/);
assert.match(rules, /match \/reports\/\{reportId\}/);
assert.match(rules, /request\.resource\.data\.reporterUid == request\.auth\.uid/);
assert.match(rules, /adminAudit/);
```

- [ ] **Step 2: Commit RED tests and verify CI fails for missing Module C contracts**

Expected failure: imports/files or required rule blocks do not exist yet.

- [ ] **Step 3: Implement minimal domain/service/rules/indexes**

```ts
export const REPORT_REASON_CODES = ['spam', 'misinformation', 'inappropriate', 'privacy', 'other'] as const;

export function buildReportId(input: { reporterUid: string; targetType: 'post' | 'comment'; postId: string; commentId: string | null }) {
  return input.targetType === 'post'
    ? `post__${input.postId}__${input.reporterUid}`
    : `comment__${input.postId}__${input.commentId}__${input.reporterUid}`;
}
```

Create report documents with deterministic IDs and server timestamp fields. Rules must deny all public writes to `adminAudit`, allow only own pending verification request self-service fields, and prohibit client verification decisions.

- [ ] **Step 4: Run Module C domain/rules tests plus existing Module B rule tests**

Run: `npm test`
Expected: new tests PASS and Module B security contract remains PASS.

- [ ] **Step 5: Commit Task 1**

Commit: `feat(module-c): add report domain and security contracts`

---

### Task 2: Public report UX for posts and comments

**Files:**
- Create: `components/portal/report-dialog.tsx`
- Modify: `components/portal/social-post-card.tsx`
- Modify: `components/portal/social-comments.tsx`
- Modify: `lib/report-service.ts`
- Test: `tests-node/module-c-public-report-contract.test.mjs`

**Interfaces:**
- Consumes: `createReport`, `REPORT_REASON_CODES` from Task 1.
- Produces: reusable `ReportDialog` accepting `{ targetType, postId, commentId?, reporterUid, onSubmitted }`.

- [ ] **Step 1: Write RED public UI contract test**

```js
assert.match(postCardSource, /ReportDialog/);
assert.match(commentSource, /ReportDialog/);
assert.match(dialogSource, /2000/);
assert.match(dialogSource, /spam/);
assert.match(dialogSource, /misinformation/);
```

- [ ] **Step 2: Commit RED test and verify expected failure**

- [ ] **Step 3: Implement report dialog and wire post/comment actions**

The dialog must expose fixed reason choices, optional details capped at 2,000 characters, disable duplicate in-flight submit, map `already-exists` to a safe “Đã báo cáo nội dung này” state, and never expose Firestore internals.

- [ ] **Step 4: Run public app tests/typecheck/lint/build**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit Task 2**

Commit: `feat(module-c): add member report workflow`

---

### Task 3: ACC policy/domain layer and authenticated shell split

**Files:**
- Create: `admin-portal/lib/module-c-policy.ts`
- Create: `admin-portal/lib/api-client.ts`
- Create: `admin-portal/app/acc-shell.tsx`
- Create: `admin-portal/app/auth-gate.tsx`
- Create: `admin-portal/app/members/page.tsx`
- Create: `admin-portal/app/system/page.tsx`
- Modify: `admin-portal/app/dashboard.tsx`
- Modify: `admin-portal/app/page.tsx`
- Test: `admin-portal/tests/module-c-policy.test.mjs`
- Test: `admin-portal/tests/module-c-shell-contract.test.mjs`

**Interfaces:**
- Produces: `canModerate(role)`, `canRestore(role)`, `canDecideVerification(role)`, `canReadFullAudit(role)`, `accApi(user, path, init)`.
- Restore and verification decision return true only for `super_mod|admin`; full audit true only for `admin`.

- [ ] **Step 1: Write RED role-policy and shell tests**

```js
assert.equal(canModerate('mod'), true);
assert.equal(canRestore('mod'), false);
assert.equal(canRestore('super_mod'), true);
assert.equal(canDecideVerification('admin'), true);
assert.equal(canReadFullAudit('super_mod'), false);
```

- [ ] **Step 2: Commit RED tests and verify failure**

- [ ] **Step 3: Implement shared policy/API client and split current dashboard responsibilities**

Keep login/password rotation in `AuthGate`; authenticated navigation lives in `AccShell`. Existing member and maintenance behavior is moved without changing authority.

- [ ] **Step 4: Run ACC test/typecheck/lint/build regression gate**

Run from `admin-portal`: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: PASS, including existing access/password/RBAC/dashboard tests.

- [ ] **Step 5: Commit Task 3**

Commit: `refactor(module-c): split ACC shell and policy boundaries`

---

### Task 4: Moderation transactions and append-only audit API

**Files:**
- Create: `admin-portal/lib/moderation.ts`
- Create: `admin-portal/lib/audit.ts`
- Create: `admin-portal/app/api/moderation/reports/route.ts`
- Create: `admin-portal/app/api/moderation/reports/[reportId]/route.ts`
- Create: `admin-portal/app/api/moderation/actions/route.ts`
- Create: `admin-portal/app/api/audit/route.ts`
- Test: `admin-portal/tests/module-c-moderation.test.mjs`
- Test: `admin-portal/tests/module-c-api-auth-contract.test.mjs`

**Interfaces:**
- Produces: `assertModerationTransition`, `resolveReportTransaction`, `restoreContentTransaction`, `buildAuditEvent`, cursor-based report/audit list endpoints.
- Moderation resolution enum is `keep | hide | soft_delete | dismiss`.
- Restore endpoint/action requires `super_mod|admin`.

- [ ] **Step 1: Write RED transition/auth/audit tests**

```js
assert.throws(() => assertModerationTransition({ reportStatus: 'resolved', action: 'hide' }), /conflict/i);
assert.equal(buildAuditEvent({ operationId: 'op1', actorUid: 'a1', actorRole: 'mod', action: 'moderation.hide', targetType: 'post', targetId: 'p1', reason: 'spam', before: { status: 'active' }, after: { status: 'hidden' } }).operationId, 'op1');
```

Static API contract tests must verify every privileged route calls token verification, password-rotation rejection, role policy, payload validation, and trusted audit creation.

- [ ] **Step 2: Commit RED tests and verify failure**

- [ ] **Step 3: Implement transaction helpers and API routes**

Use Firestore transaction semantics so report state, target post/comment state, and deterministic `adminAudit/{operationId}` agree atomically. Replays with the same operation ID must not create contradictory audit records.

- [ ] **Step 4: Run ACC tests and builds**

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

Commit: `feat(module-c): add audited moderation APIs`

---

### Task 5: Practitioner verification request and decision workflow

**Files:**
- Create: `lib/domain/verification-request.ts`
- Create: `lib/verification-service.ts`
- Modify: `storage.rules`
- Create: `admin-portal/lib/verification.ts`
- Create: `admin-portal/app/api/verification/requests/route.ts`
- Create: `admin-portal/app/api/verification/requests/[uid]/route.ts`
- Test: `tests-node/module-c-verification-contract.test.mjs`
- Test: `tests-node/module-c-storage-contract.test.mjs`
- Test: `admin-portal/tests/module-c-verification.test.mjs`

**Interfaces:**
- Public service may submit/resubmit only own request as `pending` with evidence paths under own private subtree.
- ACC decision helper accepts only pending requests; `super_mod|admin` may set `verified|rejected` and writes profile state + request state + audit in one trusted transaction.

- [ ] **Step 1: Write RED public/private verification tests**

```js
assert.match(storageRules, /verification|certificate|evidence/);
assert.match(firestoreRules, /verificationRequests/);
assert.match(firestoreRules, /pending/);
assert.throws(() => validateVerificationSubmission({ uid: 'u1', status: 'verified', evidence: [] }), /pending/);
```

- [ ] **Step 2: Commit RED tests and verify failure**

- [ ] **Step 3: Implement self-service request contract, private evidence rules, and ACC decision transaction**

Never store public download URLs for certificate evidence. Rejection requires a reason; approval/rejection updates `users/{uid}.verificationStatus`, `verificationRequests/{uid}`, and `adminAudit/{operationId}` consistently.

- [ ] **Step 4: Run root + ACC security/build regression gates**

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

Commit: `feat(module-c): add practitioner verification workflow`

---

### Task 6: ACC moderation, verification, audit, and operational screens

**Files:**
- Create: `admin-portal/app/moderation/page.tsx`
- Create: `admin-portal/app/verification/page.tsx`
- Create: `admin-portal/app/audit/page.tsx`
- Create: `admin-portal/app/components/moderation-queue.tsx`
- Create: `admin-portal/app/components/verification-queue.tsx`
- Create: `admin-portal/app/components/audit-table.tsx`
- Modify: `admin-portal/app/globals.css`
- Test: `admin-portal/tests/module-c-ui-contract.test.mjs`

**Interfaces:**
- Consumes authenticated `accApi` and policy helpers.
- Queue defaults: reports `open`, `createdAt asc`; verification `pending`, `submittedAt asc`; bounded pages with cursor tokens.

- [ ] **Step 1: Write RED UI contract tests**

```js
assert.match(moderationPage, /open/);
assert.match(moderationPage, /hide|soft_delete/);
assert.match(verificationPage, /verified|rejected/);
assert.match(auditPage, /canReadFullAudit|admin/);
```

- [ ] **Step 2: Commit RED test and verify failure**

- [ ] **Step 3: Implement focused screens with sanitized loading/error/conflict states**

Disable duplicate action submission, require reasons where specified, show restore only for `super_mod/admin`, show full audit only for admin, and retain member/system navigation.

- [ ] **Step 4: Run ACC full quality gate**

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

Commit: `feat(module-c): add ACC moderation operations UI`

---

### Task 7: Public practitioner verification status/submission surface

**Files:**
- Create: `components/portal/verification-panel.tsx`
- Modify: `components/portal/member-screens.tsx`
- Modify: `app/profile/page.tsx` if the current route orchestrates profile directly; otherwise modify the existing profile-screen component selected by the current route.
- Test: `tests-node/module-c-profile-verification-contract.test.mjs`

**Interfaces:**
- Consumes `verification-service.ts` from Task 5.
- Only current user sees their submission/evidence controls; other member profiles display only safe club-facing `verificationStatus`.

- [ ] **Step 1: Write RED profile verification contract**

```js
assert.match(panelSource, /pending/);
assert.match(panelSource, /rejected/);
assert.doesNotMatch(panelSource, /downloadURL/);
```

- [ ] **Step 2: Commit RED test and verify failure**

- [ ] **Step 3: Implement safe own-profile submission/status UI**

Do not expose another member's private evidence path or any signed/private download URL.

- [ ] **Step 4: Run public app full gate**

Expected: PASS.

- [ ] **Step 5: Commit Task 7**

Commit: `feat(module-c): add verification self-service UI`

---

### Task 8: CI, regression, release-readiness, and production-boundary verification

**Files:**
- Modify only if required: `.github/workflows/ci.yml`
- Modify only if required by changed rules paths: existing Firebase validation/deploy workflows without widening WIF conditions.
- Test: `tests-node/module-c-production-boundary.test.mjs`
- Update: `README.md` with Module C operational capabilities after all checks pass.

**Interfaces:**
- Produces a branch state eligible for PR into the established integration/release flow; never deploys production Firebase from the Module C branch.

- [ ] **Step 1: Add RED/contract assertions for production trust boundaries**

```js
assert.match(firebaseDeployWorkflow, /branches:\s*\[?main/);
assert.doesNotMatch(firebaseDeployWorkflow, /beta\/2\.0-module-c.*workload_identity_provider/s);
```

- [ ] **Step 2: Run complete root and ACC quality gates**

Root: `npm test && npm run typecheck && npm run lint && npm run build`

ACC: `cd admin-portal && npm test && npm run typecheck && npm run lint && npm run build`

Expected: all PASS.

- [ ] **Step 3: Inspect GitHub Actions on exact Module C head SHA**

Required: public validation and ACC validation green. Firebase production deploy must not authenticate/deploy from the Module C branch.

- [ ] **Step 4: Verify no migration workflow or private migration package was changed**

Compare Module C head to production baseline and confirm no unnecessary production re-import is triggered.

- [ ] **Step 5: Update README and commit final readiness state**

Commit: `docs(module-c): document moderation control plane`

- [ ] **Step 6: Final self-review**

Confirm spec coverage: reports, deterministic IDs, moderation lifecycle, restore authority, verification transactions, private evidence, append-only audit, ACC route split, bounded queues, rules/storage/indexes, public UX, regression gates, production WIF boundary. Search changed files for `TODO`, `TBD`, credentials, service-account JSON, private member data, and debug logging before calling Module C complete.
