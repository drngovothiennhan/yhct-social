# Beta 2.0 Module D Backup & Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a controlled, auditable recovery plane with Safe Mode, sanitized error boundaries, managed backup/export checkpoint orchestration, isolated restore validation, and strict production isolation.

**Architecture:** ACC owns all privileged recovery mutations through Firebase Admin/server-only Google Cloud provider code. Public runtime only receives sanitized recovery state; restore/export operations persist manifests and provider operation IDs, and every destructive-capable workflow targets an isolated recovery database before any later production cutover.

**Tech Stack:** Next.js App Router, TypeScript, React 19, Firebase Auth/Firestore/Admin, Google Cloud Firestore Admin REST APIs, ADC/WIF, Vercel, Node test runner, ESLint.

**Spec:** `docs/superpowers/specs/2026-09-05-beta-2-module-d-backup-recovery-design.md`

## Global Constraints

- Feature branch: `beta/2.0-module-d-recovery`, based exactly on `release/v1.0` SHA `6c7253e9c1eac46ae2581a126e2f40d044a7bde8`.
- `main` remains production baseline and must not move during Module D feature/release integration.
- Preserve `member < mod < super_mod < admin`; every recovery mutation requires `admin` and rejects `mustChangePassword=true`.
- No service-account JSON, Firebase token fallback, refresh token, client-side Admin SDK, arbitrary browser-supplied GCP project/bucket/database authority, or widened production WIF.
- No automatic production restore, import, database cutover, DNS switch, or Vercel environment switch.
- No document-by-document custom backup engine.
- All privileged recovery mutations require stable `operationId`, append-only `adminAudit`, sanitized errors, and retry-safe provider-operation handling.
- Provider full resource names, GCS prefixes, access tokens, raw Google API bodies, and restore database internals stay server-side.
- Existing Modules A/B/C must remain green.

---

### Task 1: Recovery State Domain and Admin-Only State API

**Files:**
- Create: `admin-portal/lib/recovery-policy.ts`
- Create: `admin-portal/lib/recovery-state.ts`
- Create: `admin-portal/app/api/recovery/state/route.ts`
- Modify: `admin-portal/lib/audit.ts`
- Test: `admin-portal/tests/module-d-recovery-policy.test.mjs`
- Test: `admin-portal/tests/module-d-recovery-state-contract.test.mjs`

**Interfaces:**
- Produces `RecoveryMode = 'normal'|'degraded'|'safe_mode'|'restoring'`.
- Produces `assertRecoveryTransition(from,to): void`.
- Produces `setRecoveryState({ mode, reason, operationId }, actor)` and `getRecoveryState()`.
- Extends audit target types with `recovery`.

- [ ] **Step 1: Write RED policy tests**

```js
assert.doesNotThrow(() => assertRecoveryTransition('normal','degraded'));
assert.doesNotThrow(() => assertRecoveryTransition('safe_mode','restoring'));
assert.throws(() => assertRecoveryTransition('restoring','degraded'), /RECOVERY_STATE_CONFLICT/);
```

Also verify empty reason/operation ID reject and only valid modes parse.

- [ ] **Step 2: Write RED API/source contracts**

Assert mutation route calls `requireAccRole(request, 'admin')`, never accepts `updatedBy`, timestamps, project IDs, bucket names or provider refs from request payload, and uses `accErrorResponse` for unexpected failures.

- [ ] **Step 3: Run RED**

```bash
cd admin-portal && node --experimental-strip-types --test tests/module-d-recovery-policy.test.mjs tests/module-d-recovery-state-contract.test.mjs
```

Expected: FAIL because Module D recovery files do not exist.

- [ ] **Step 4: Implement policy/state service**

Use `system/recovery` as canonical document. Transaction checks `adminAudit/{operationId}` for exact replay/conflict, validates current transition, updates recovery state, and creates audit event atomically.

- [ ] **Step 5: Implement GET/POST route**

`GET` requires at least `mod` and returns sanitized state. `POST` requires `admin` and accepts only `{ mode, reason, operationId }`.

- [ ] **Step 6: Verify GREEN**

```bash
cd admin-portal && npm test && npm run typecheck && npm run lint
```

- [ ] **Step 7: Commit**

```bash
git add admin-portal/lib/recovery-policy.ts admin-portal/lib/recovery-state.ts admin-portal/app/api/recovery/state admin-portal/lib/audit.ts admin-portal/tests/module-d-recovery-*.test.mjs
git commit -m "feat(module-d): add recovery state control"
```

---

### Task 2: Public and ACC Error Boundaries

**Files:**
- Create: `app/error.tsx`
- Create: `app/global-error.tsx`
- Create: `admin-portal/app/error.tsx`
- Create: `admin-portal/app/global-error.tsx`
- Test: `tests-node/module-d-error-boundary-contract.test.mjs`
- Test: `admin-portal/tests/module-d-error-boundary-contract.test.mjs`

**Interfaces:**
- Route-level boundaries accept `{ error, reset }` and expose retry without raw exception output.
- Global boundaries render their own `<html><body>` wrapper as required by Next.js.

- [ ] **Step 1: Write RED contracts**

Assert each error boundary is `'use client'`, renders safe user copy, calls `reset`, and does not render `error.message`, `error.stack`, tokens, localStorage/sessionStorage dumps, provider responses or `JSON.stringify(error)`.

- [ ] **Step 2: Run RED**

```bash
node --experimental-strip-types --test tests-node/module-d-error-boundary-contract.test.mjs && cd admin-portal && node --experimental-strip-types --test tests/module-d-error-boundary-contract.test.mjs
```

- [ ] **Step 3: Implement minimal boundaries**

Public copy: generic recovery-safe message and retry button. ACC copy: generic admin failure message, retry button, and instruction to open Recovery Center if problem persists.

- [ ] **Step 4: Verify GREEN**

```bash
npm run check && npm run build && cd admin-portal && npm run check && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add app/error.tsx app/global-error.tsx admin-portal/app/error.tsx admin-portal/app/global-error.tsx tests-node/module-d-error-boundary-contract.test.mjs admin-portal/tests/module-d-error-boundary-contract.test.mjs
git commit -m "feat(module-d): add sanitized error boundaries"
```

---

### Task 3: Google Cloud Recovery Provider Client

**Files:**
- Create: `admin-portal/lib/recovery-provider.ts`
- Test: `admin-portal/tests/module-d-recovery-provider.test.mjs`
- Modify: `.env.example`

**Interfaces:**
- Produces `listManagedBackups()`.
- Produces `startExportCheckpoint(input)`.
- Produces `startManagedBackupRestore(input)`.
- Produces `startImportToRecoveryDatabase(input)`.
- Produces `getProviderOperation(operationName)`.
- Uses existing ADC/WIF-compatible auth patterns only.

- [ ] **Step 1: Write RED provider security tests**

Assert provider source contains no `service_account`, private key, refresh token, `FIREBASE_TOKEN`, or browser env authority. Assert full provider REST calls are confined to this module.

- [ ] **Step 2: Write RED normalization tests**

Dependency-inject fetch/auth token acquisition and verify provider responses normalize to safe shapes: `{ id, state, startedAt, completedAt, expiresAt }` or `{ operationId, done, errorCode }` without raw response bodies.

- [ ] **Step 3: Run RED**

```bash
cd admin-portal && node --experimental-strip-types --test tests/module-d-recovery-provider.test.mjs
```

- [ ] **Step 4: Implement server-only provider**

Use `google-auth-library`/ADC already present in ACC. Server derives project/database/bucket/prefix from env; caller may pass only validated logical backup/checkpoint IDs previously emitted by server.

- [ ] **Step 5: Verify GREEN**

```bash
cd admin-portal && npm test && npm run typecheck && npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add admin-portal/lib/recovery-provider.ts admin-portal/tests/module-d-recovery-provider.test.mjs .env.example
git commit -m "feat(module-d): add server-only recovery provider"
```

---

### Task 4: Checkpoint Manifests and Managed Backup Inventory APIs

**Files:**
- Create: `admin-portal/lib/recovery-manifests.ts`
- Create: `admin-portal/app/api/recovery/backups/route.ts`
- Create: `admin-portal/app/api/recovery/checkpoints/route.ts`
- Create: `admin-portal/app/api/recovery/manifests/route.ts`
- Test: `admin-portal/tests/module-d-recovery-manifests.test.mjs`

**Interfaces:**
- Produces `createExportCheckpoint(...)`.
- Produces `listRecoveryManifests({ limit, cursor })`, max 50.
- Manifest stores provider operation ID/resource server-side; API returns sanitized DTO.

- [ ] **Step 1: Write RED manifest/idempotency tests**

Verify same `operationId` + same immutable input replays prior operation; same ID + different SHA/reason/kind returns `RECOVERY_OPERATION_CONFLICT`; destination bucket/prefix cannot be overridden from request.

- [ ] **Step 2: Write RED bounded-list tests**

Hard-cap inventory/manifests at 50, cursor-based, newest-first where supported.

- [ ] **Step 3: Run RED**

```bash
cd admin-portal && node --experimental-strip-types --test tests/module-d-recovery-manifests.test.mjs
```

- [ ] **Step 4: Implement checkpoint flow**

Create manifest `requested`, call provider once, persist provider operation identity and move to `running`; replay polls/reuses same operation rather than starting duplicate export.

- [ ] **Step 5: Implement routes**

All routes require `admin` except sanitized list may still be admin-only for v1. Request body allows `{ operationId, reason, sourceReleaseSha, collectionIds? }` only.

- [ ] **Step 6: Verify GREEN and commit**

```bash
cd admin-portal && npm run check && npm run build
git add admin-portal/lib/recovery-manifests.ts admin-portal/app/api/recovery admin-portal/tests/module-d-recovery-manifests.test.mjs
git commit -m "feat(module-d): add recovery checkpoint manifests"
```

---

### Task 5: Isolated Restore, Import, and Validation Workflow

**Files:**
- Create: `admin-portal/lib/recovery-restore.ts`
- Create: `admin-portal/lib/recovery-validation.ts`
- Create: `admin-portal/app/api/recovery/restores/route.ts`
- Create: `admin-portal/app/api/recovery/imports/route.ts`
- Create: `admin-portal/app/api/recovery/manifests/[manifestId]/validate/route.ts`
- Create: `admin-portal/app/api/recovery/manifests/[manifestId]/decision/route.ts`
- Test: `admin-portal/tests/module-d-recovery-restore.test.mjs`
- Test: `admin-portal/tests/module-d-recovery-validation.test.mjs`

**Interfaces:**
- Produces `deriveRecoveryDatabaseId(operationId, now)`; output always starts `recovery-` and cannot equal production database ID.
- Produces `startRestoreToRecoveryDatabase(...)`.
- Produces `validateRecoveryCandidate(...)` returning sanitized `RecoveryValidationSummary`.
- Produces `decideRecoveryManifest(manifestId,'verified'|'rejected',...)`.

- [ ] **Step 1: Write RED target-safety tests**

Assert explicit rejection of `(default)`, configured live database ID, arbitrary client database name, arbitrary `gs://` import URI, and unverified/nonexistent manifest input.

- [ ] **Step 2: Write RED validation tests**

Validation summary contains only booleans/counts/status codes and bounded warnings; no raw document contents, emails, certificate paths, provider bodies or credentials.

- [ ] **Step 3: Run RED**

```bash
cd admin-portal && node --experimental-strip-types --test tests/module-d-recovery-restore.test.mjs tests/module-d-recovery-validation.test.mjs
```

- [ ] **Step 4: Implement isolated restore/import**

Server derives recovery database ID; provider operation is persisted to manifest. Operation stays asynchronous. No code path switches production database config.

- [ ] **Step 5: Implement bounded read-only validation**

Check expected system markers and a small allowlist of critical collections/documents; never scan full collections. Reject incompatible schema marker.

- [ ] **Step 6: Implement verify/reject decision**

Admin-only; writes manifest decision plus audit. `verified` means cutover candidate only, not automatic cutover.

- [ ] **Step 7: Verify GREEN and commit**

```bash
cd admin-portal && npm run check && npm run build
git add admin-portal/lib/recovery-restore.ts admin-portal/lib/recovery-validation.ts admin-portal/app/api/recovery admin-portal/tests/module-d-recovery-restore.test.mjs admin-portal/tests/module-d-recovery-validation.test.mjs
git commit -m "feat(module-d): add isolated restore validation"
```

---

### Task 6: Public Recovery State and Safe Mode UX

**Files:**
- Create: `lib/server/recovery-public.ts`
- Create: `app/api/recovery/status/route.ts`
- Create: `components/portal/recovery-banner.tsx`
- Modify: `components/portal/portal-shell.tsx`
- Test: `tests-node/module-d-safe-mode.test.mjs`

**Interfaces:**
- Produces sanitized public state `{ mode, readOnly, message, retryAfterSeconds? }`.
- UI shows recovery/degraded banner without provider details.

- [ ] **Step 1: Write RED public-boundary tests**

Assert public route does not expose reason internals, actor UID, operation ID, backup IDs, GCS path, provider resource, service account or stack info. Assert Safe Mode banner is mounted in portal shell.

- [ ] **Step 2: Run RED**

```bash
node --experimental-strip-types --test tests-node/module-d-safe-mode.test.mjs
```

- [ ] **Step 3: Implement sanitized public status**

Read `system/recovery` server-side with root Admin. Map internal state to fixed safe messages. `normal` may return minimal state only.

- [ ] **Step 4: Implement UI behavior**

Banner informs users when degraded/read-only. Do not falsely claim all direct Firestore writes are universally blocked unless rules enforcement is actually added and tested.

- [ ] **Step 5: Verify GREEN and commit**

```bash
npm run check && npm run build
git add lib/server/recovery-public.ts app/api/recovery/status components/portal/recovery-banner.tsx components/portal/portal-shell.tsx tests-node/module-d-safe-mode.test.mjs
git commit -m "feat(module-d): add safe mode runtime UX"
```

---

### Task 7: ACC Recovery Control Center

**Files:**
- Create: `admin-portal/app/recovery/page.tsx`
- Create: `admin-portal/app/components/recovery-control-center.tsx`
- Modify: `admin-portal/app/acc-shell.tsx`
- Test: `admin-portal/tests/module-d-recovery-ui-contract.test.mjs`

**Interfaces:**
- UI consumes only `/api/recovery/*` routes.
- Mutation controls visible only for `admin`, but server authorization remains authoritative.

- [ ] **Step 1: Write RED UI/nav tests**

Assert `/recovery` navigation exists while all existing routes remain. Assert screen shows current mode, backup inventory, checkpoints, manifests, restore candidate validation, verify/reject, Safe Mode controls, and explicit `production cutover is not automatic` warning.

- [ ] **Step 2: Run RED**

```bash
cd admin-portal && node --experimental-strip-types --test tests/module-d-recovery-ui-contract.test.mjs
```

- [ ] **Step 3: Implement focused control center**

Use existing authenticated API client. Every mutation generates/reuses operation ID per action and disables duplicate submission while in flight. Never render full GCS/provider resource names.

- [ ] **Step 4: Update ACC shell**

Add `['/recovery','Khôi phục']`; preserve AI, moderation, verification, audit and system links. Replace fixed `Module C` heading with neutral `YHCT Social · Beta 2.0`.

- [ ] **Step 5: Verify GREEN and commit**

```bash
cd admin-portal && npm run check && npm run build
git add admin-portal/app/recovery admin-portal/app/components/recovery-control-center.tsx admin-portal/app/acc-shell.tsx admin-portal/tests/module-d-recovery-ui-contract.test.mjs
git commit -m "feat(module-d): add recovery control center"
```

---

### Task 8: Security Rules, Release Readiness, PR Merge, and Post-Merge Verification

**Files:**
- Modify only if required: `firestore.rules`
- Create: `tests-node/module-d-recovery-security.test.mjs`
- Create: `tests-node/module-d-recovery-release-readiness.test.mjs`
- Modify: `README.md`

**Interfaces:**
- Recovery collections remain server-only.
- Production deploy workflow remains `main`-only WIF-authenticated.

- [ ] **Step 1: Write RED/semantic security contracts**

Verify `system/recovery` and `recoveryManifests` are not client-writable/readable through any explicit permissive rule, or are protected by authoritative catch-all deny. Scan Module D production source for `FIREBASE_TOKEN`, private key, SA JSON, refresh token, browser-supplied bucket/project/database authority, raw error logging and auto-cutover code.

- [ ] **Step 2: Write release-isolation contract**

Assert `.github/workflows/deploy-firebase-rules.yml` still has `branches: [main]`, `if: github.ref == 'refs/heads/main'`, and production WIF provider is unchanged. Assert no feature/release recovery workflow gets `id-token: write` for production deployment.

- [ ] **Step 3: Apply minimal rules changes only if necessary**

Prefer existing catch-all default deny. Do not add redundant rules or speculative indexes.

- [ ] **Step 4: Run full root gate**

```bash
npm test && npm run typecheck && npm run lint && npm run build
```

- [ ] **Step 5: Run full ACC gate**

```bash
cd admin-portal && npm test && npm run typecheck && npm run lint && npm run build
```

- [ ] **Step 6: Update README**

Document Safe Mode, error boundaries, checkpoint/restore semantics, isolated recovery database validation, server-only provider config, no automatic cutover, and verification commands.

- [ ] **Step 7: Verify exact feature head in PR CI**

Require public+ACC green on exact head SHA. Confirm no production Firebase deploy/restore/import job runs from feature branch.

- [ ] **Step 8: Merge exact head to `release/v1.0` only**

Use expected-head guard. PR body records substitutions, security boundaries and exact CI evidence.

- [ ] **Step 9: Verify exact release merge SHA**

Require post-merge public+ACC CI green. Confirm `main` SHA remains `031a347499ea29330f800c0254437337a46376e0` unless separately changed by an external explicit production action; confirm no production recovery/deploy run triggered.

- [ ] **Step 10: Completion gate**

Module D is complete only when all eight capabilities are release-integrated and production-isolated: state machine, error boundaries, provider client, checkpoint manifests, isolated restore/import, validation, Safe Mode UX, ACC Recovery Center/security/release gates.
