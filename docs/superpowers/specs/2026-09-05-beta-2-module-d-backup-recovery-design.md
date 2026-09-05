# YHCT Social Beta 2.0 — Module D Backup & Recovery

## Scope

Module D adds operational resilience without changing the application’s product domain. It provides controlled Firestore backup/checkpoint orchestration, safe restore validation, application error boundaries, Safe Mode, and auditable recovery controls while preserving all Module A/B/C security and production-isolation guarantees.

Module D delivers eight independently testable areas:

1. Recovery state machine with `normal | degraded | safe_mode | restoring`.
2. Public and ACC Next.js error boundaries with sanitized fallback behavior.
3. Admin-only Recovery Control Center in ACC.
4. Managed Firestore backup visibility plus manual export checkpoint orchestration.
5. Verified recovery manifests and restore preparation.
6. Restore-to-new-database validation before any production cutover.
7. Controlled Safe Mode/self-recovery behavior without autonomous destructive restore.
8. Audit-complete security, release verification, and production isolation.

Module D does not add club points, activity scoring, messaging, payments, medical automation, background destructive repair, or a second identity system.

## Baseline and branch boundary

The integration baseline is `release/v1.0` commit `6c7253e9c1eac46ae2581a126e2f40d044a7bde8`.

The production baseline remains `main` commit `031a347499ea29330f800c0254437337a46376e0` until an explicit production promotion is separately approved.

Official Module D development occurs only on `beta/2.0-module-d-recovery` until feature and post-merge release verification gates are green.

The older branch `beta/2.0-module-d` and PR #8 are provenance only for a roadmap correction and must never be merged into `release/v1.0` or `main`.

Production Google workload identity remains scoped to the existing `main` trust boundary. Module D must not widen WIF to feature or release branches.

## Architecture choice

Module D uses a managed-backup-first design:

- Firestore managed backups provide the primary scheduled disaster-recovery layer.
- Firestore export-to-GCS provides explicit checkpoints before risky releases, migrations, or administrative data operations.
- Recovery operations are orchestrated from trusted ACC server routes.
- Restore targets a separate recovery database first; validation is mandatory before any later cutover.
- Application runtime resilience is provided by Error Boundaries, Safe Mode, bounded retry, and degradation rather than automatic database restore.

Module D explicitly rejects a custom document-by-document backup engine built on ordinary Firestore reads/writes because it would add consistency, cost, scaling, and restore-integrity risks.

## Core principles

### Managed backup over custom snapshot logic

Backup durability should depend on Google Cloud managed capabilities, not application code iterating collections.

### Restore is not rollback-in-place

A backup is never restored directly into the live production database as a one-click operation. Recovery creates or targets a separate recovery database, validates it, and produces a cutover candidate.

### No autonomous destructive recovery

The application may enter degraded or safe mode automatically based on bounded runtime failure signals, but it never autonomously launches Firestore restore/import, deletes data, or switches production database authority.

### Audit before mutation

Every privileged recovery state change, checkpoint request, restore preparation, validation decision, and cutover recommendation writes an append-only `adminAudit/{operationId}` event from trusted server code.

### Server-only provider access

Cloud Firestore Admin/backup/export APIs and Cloud Storage checkpoint locations are accessed only from trusted server code using ADC/WIF-compatible credentials. No service-account JSON, refresh token, Firebase token fallback, or browser credential is allowed.

## Recovery state model

### `system/recovery`

Canonical document fields:

- `mode: 'normal' | 'degraded' | 'safe_mode' | 'restoring'`
- `reason: string`
- `updatedBy: string`
- `updatedAt: Timestamp`
- `activeOperationId: string | null`
- `lastKnownHealthyAt: Timestamp | null`
- `readOnlyPublic: boolean`
- `mutationBlockReason: string | null`

Only trusted admin server code may mutate this document.

### State semantics

#### `normal`

- regular product behavior.
- ordinary writes allowed according to existing auth/rules.

#### `degraded`

- nonessential features may reduce activity.
- AI/provider-heavy or expensive optional features may be disabled.
- core authentication, safe reads, and existing manual content flows continue where possible.
- data mutations are not globally blocked unless the specific failing dependency requires it.

#### `safe_mode`

- public application is effectively read-only for high-risk mutations.
- authentication and safe reads remain available.
- ACC remains available for recovery-capable admins.
- user-facing messaging must identify maintenance/recovery mode without leaking internal error details.

#### `restoring`

- recovery operation is actively being prepared or validated.
- public high-risk writes are blocked.
- ACC exposes operation status to authorized admins.
- restoring does not imply production cutover has occurred.

### Allowed transitions

Normal transitions:

- `normal -> degraded`
- `degraded -> normal`
- `normal -> safe_mode`
- `degraded -> safe_mode`
- `safe_mode -> normal`
- `safe_mode -> restoring`
- `restoring -> safe_mode`
- `restoring -> normal` only after validation and explicit admin completion.

Direct `normal -> restoring` is allowed only for an explicit admin-authorized planned restore workflow that first blocks risky mutations transactionally.

All recovery-mode transitions require an `operationId`, a nonempty reason, admin authority, and audit evidence.

## Runtime Safe Mode behavior

### Public app

Module D adds a lightweight server-readable recovery-state endpoint or server-side loader that returns sanitized recovery state.

Public clients may receive only:

- current mode;
- read-only flag;
- user-safe maintenance message/version;
- retry-after hint when configured.

Public clients must not receive:

- internal GCS paths;
- backup IDs;
- restore database IDs;
- service account or project credential details;
- stack traces;
- admin actor UIDs;
- raw provider errors.

High-risk public mutations check recovery mode at the trusted server boundary where such server routes exist. Existing direct Firestore writes that cannot be intercepted safely must be protected by Firestore rules driven by existing maintenance/recovery state only if rules can read the state deterministically and without weakening existing rules. If that introduces brittle complexity, Module D instead limits Safe Mode mutation blocking to the server-brokered high-risk paths and displays a read-only UI without falsely claiming universal client-write enforcement.

### ACC

ACC remains accessible in safe mode for `admin` users and continues to use existing password-rotation/session gates.

Non-admin privileged actors may view a sanitized recovery banner but cannot invoke recovery mutations.

## Error Boundary design

### Public application

Add:

- `app/error.tsx` for route-tree runtime errors.
- `app/global-error.tsx` for root layout failures.

Requirements:

- client components as required by Next.js error conventions.
- human-readable fallback.
- retry/reset action where supported.
- no stack trace or raw exception body.
- no token/session/localStorage dump.
- preserve app shell where route-level error allows.

### ACC

Add equivalent route/global boundaries under `admin-portal/app`.

ACC fallback must not expose privileged operation payloads, bearer tokens, private evidence URLs, provider response bodies, or credential details.

### Error telemetry boundary

Module D may record safe server-side error digests/operation IDs where existing logging permits, but raw private prompt/document/credential content remains prohibited. Error Boundary UI itself does not write sensitive diagnostics to Firestore.

## Backup inventory model

### Managed Firestore backups

Module D treats managed backup policies and backup instances as provider-owned resources.

ACC may list sanitized fields such as:

- backup resource identifier suffix;
- source database;
- creation/start/completion time;
- expiration time;
- backup state;
- database edition/metadata needed for compatibility checks.

Full provider resource names may remain server-side when exposing them would add no user value.

### `recoveryManifests/{manifestId}`

Application-owned metadata for manual export checkpoints and restore workflows.

Fields:

- `manifestId: string`
- `operationId: string`
- `kind: 'export_checkpoint' | 'managed_backup_restore' | 'import_validation'`
- `sourceProjectId: string`
- `sourceDatabaseId: string`
- `sourceReleaseSha: string`
- `providerResourceRef: string`
- `storagePrefix: string | null`
- `requestedBy: string`
- `requestedAt: Timestamp`
- `status: 'requested' | 'running' | 'completed' | 'failed' | 'verified' | 'rejected'`
- `completedAt: Timestamp | null`
- `verifiedBy: string | null`
- `verifiedAt: Timestamp | null`
- `validationSummary: RecoveryValidationSummary | null`
- `failureCode: string | null`

`providerResourceRef` and `storagePrefix` are server-owned. Public app never reads recovery manifests. ACC only returns sanitized forms to admin.

## Manual export checkpoint

### Trigger

Admin-only endpoint creates a checkpoint request before:

- production migration;
- destructive data cleanup;
- major cutover;
- explicit admin recovery checkpoint.

Required input:

- `operationId`;
- reason;
- source release SHA;
- optional collection allowlist when partial export is deliberately requested.

The browser never supplies arbitrary bucket credentials or arbitrary provider identity.

### Destination policy

Checkpoint destination is derived server-side from configured project/bucket/prefix settings.

Input may not override:

- project ID;
- bucket authority;
- root recovery prefix;
- service account identity.

### Consistency

When provider APIs support a snapshot-time option compatible with the current database, Module D prefers a single consistent snapshot time for the checkpoint. Otherwise the provider-native export operation remains the authority; application code does not emulate consistency by reading collections itself.

## Managed backup restore workflow

### Stage 1 — Select provider backup

Admin selects one server-listed eligible managed backup. The client submits only a stable sanitized ID/ref previously issued by the server.

### Stage 2 — Create recovery target

Restore targets a new recovery database ID derived server-side, for example:

`recovery-YYYYMMDD-HHMM-<shortOperationId>`

Client cannot choose an arbitrary database name.

### Stage 3 — Enter restoring/safe mode

For a planned production recovery, trusted code transitions `system/recovery` to `restoring` or `safe_mode` before any later cutover steps.

### Stage 4 — Provider restore

Trusted server code invokes provider restore using ADC/WIF-compatible credentials.

The route returns an accepted operation state rather than pretending restore completes synchronously.

### Stage 5 — Validate recovery database

Validation must be read-only and bounded. Required checks include:

- database exists and is reachable;
- expected critical collections exist where applicable;
- bounded sample/document count metadata where supported;
- representative schema/version markers;
- privileged users/config documents are structurally valid;
- no obvious missing mandatory system documents;
- release compatibility marker matches an accepted application schema range.

Module D does not promise byte-for-byte equivalence validation if the provider does not expose such a primitive.

### Stage 6 — Mark manifest verified/rejected

Admin reviews validation summary. Only admin may mark candidate `verified` or `rejected`.

### Stage 7 — Cutover recommendation, not automatic production switch

Module D produces a verified recovery candidate and documented cutover readiness. Actual production database cutover remains a separate explicitly approved production operation outside automatic Module D execution unless a later plan explicitly adds and verifies it.

## Export/import rollback workflow

Manual export checkpoints may support import into a recovery database for targeted rollback testing.

Rules:

- import source must come from an existing server-owned `recoveryManifests` record with `status='completed'` or `verified`.
- browser cannot submit arbitrary `gs://` URLs.
- operation is admin-only.
- destination must be a server-derived recovery database, never live production.
- import operation is asynchronous and represented in manifest status.

## Recovery validation summary

`RecoveryValidationSummary` contains only safe operational metadata:

- `databaseReachable: boolean`
- `schemaCompatible: boolean`
- `criticalCollections: Record<string, 'present' | 'missing' | 'unknown'>`
- `sampleChecksPassed: number`
- `sampleChecksFailed: number`
- `warnings: string[]`
- `validatedAt: Timestamp`

Warnings are bounded sanitized codes/messages, not raw document contents.

## Self-recovery and retry policy

Module D supports bounded retry only for transient runtime/provider calls where retry is safe and idempotent.

Rules:

- exponential/bounded backoff with small maximum attempt count;
- never retry non-idempotent recovery mutations without `operationId`/provider operation identity;
- repeated provider failure may surface `degraded` recommendation/state;
- runtime error count alone never triggers database restore/import;
- safe mode may be entered automatically only through a deterministic server-side policy if implemented and tested; otherwise v1 uses admin-triggered safe mode plus error-boundary degradation.

YAGNI default for Module D v1: admin-triggered safe mode plus deterministic runtime fallback; no autonomous state flapping based on browser error counts.

## ACC Recovery Control Center

New route:

- `/recovery`

Sections:

1. Current recovery mode and reason.
2. Managed backup inventory.
3. Manual export checkpoint controls.
4. Recovery manifests and operation states.
5. Restore-to-recovery-database workflow.
6. Validation summary and verify/reject actions.
7. Safe Mode controls.
8. Clear notice that production cutover is not automatic.

Only `admin` may invoke recovery mutations. Lower privileged roles receive no mutation controls and server routes still enforce authorization independently of UI.

## ACC server API boundaries

Expected routes:

- `GET /api/recovery/state`
- `POST /api/recovery/state`
- `GET /api/recovery/backups`
- `POST /api/recovery/checkpoints`
- `GET /api/recovery/manifests`
- `POST /api/recovery/restores`
- `POST /api/recovery/imports`
- `POST /api/recovery/manifests/[manifestId]/validate`
- `POST /api/recovery/manifests/[manifestId]/decision`

Exact file decomposition may be simplified if existing ACC patterns are safer, but trust boundaries may not be weakened.

Every privileged mutation endpoint must:

1. require Firebase ID token through existing ACC auth.
2. reject `mustChangePassword=true`.
3. require `admin`.
4. validate `operationId`, IDs, reason, state transition and server-derived provider refs.
5. avoid accepting credentials/project/bucket/service account authority from browser.
6. write append-only audit evidence.
7. return sanitized errors.
8. be retry-safe when the provider call may be replayed.

## Provider client boundary

Create a focused server module for Google Cloud recovery operations.

Responsibilities:

- acquire ADC/WIF-compatible auth using existing server runtime patterns;
- call documented Firestore Admin/backup/export/restore APIs;
- normalize provider operation states;
- map provider errors to stable internal codes;
- never log credentials/access tokens;
- never expose raw provider response bodies to clients.

The provider client is the only Module D location allowed to know full managed-backup resource names, Cloud Storage recovery prefixes, or Firestore Admin API operation URLs.

## Firestore security boundary

Client direct writes are denied for:

- `system/recovery`;
- `recoveryManifests`;
- `adminAudit` recovery events.

Client direct reads of `recoveryManifests` are denied.

Public recovery state, if direct Firestore read is used at all, must be projected through a separate sanitized document or, preferably, returned by a server route. Preferred v1 design is server route to avoid exposing internal recovery fields.

Existing catch-all default deny remains authoritative for new unmatched collections.

Module D must not weaken rules for reports, verification, certificates, AI collections, roles, user profiles, posts, comments, or storage evidence.

## Idempotency

Every recovery mutation has a stable `operationId`.

`adminAudit/{operationId}` remains the authoritative privileged-operation receipt where appropriate.

A replay with matching immutable input returns the prior operation state/result.

Reuse of the same operation ID with different action, target, provider backup, source checkpoint, or state transition returns conflict and performs no new provider mutation.

Provider long-running operation identifiers are persisted in `recoveryManifests` so polling/retry uses the same provider operation instead of starting duplicates.

## Error handling

Stable internal errors include:

- `RECOVERY_FORBIDDEN`
- `RECOVERY_STATE_CONFLICT`
- `RECOVERY_OPERATION_CONFLICT`
- `RECOVERY_PROVIDER_UNAVAILABLE`
- `RECOVERY_BACKUP_NOT_FOUND`
- `RECOVERY_CHECKPOINT_INVALID`
- `RECOVERY_MANIFEST_NOT_READY`
- `RECOVERY_TARGET_INVALID`
- `RECOVERY_VALIDATION_FAILED`
- `RECOVERY_SCHEMA_INCOMPATIBLE`

HTTP mapping stays sanitized and does not include raw Google API messages unless reduced to an approved safe code.

## Configuration

Server-only environment variables may include:

- recovery GCP project ID when not safely derivable from existing project config;
- recovery bucket name/prefix for manual exports;
- optional backup database ID when not `(default)`;
- accepted schema compatibility range.

No recovery configuration is prefixed `NEXT_PUBLIC_` except existing nonsecret Firebase public config unrelated to provider authority.

## Testing strategy

Module D uses TDD.

Required test areas:

1. Recovery state transitions and admin-only authority.
2. Error Boundary contract and secret-free UI.
3. Provider client confinement/security strings.
4. Checkpoint manifest validation and server-derived destination policy.
5. Restore target derivation and prohibition on live-production destination.
6. Idempotent provider operation replay.
7. Recovery validation summary sanitization.
8. Safe Mode public/ACC behavior.
9. Firestore default-deny/server-only recovery collections.
10. Main-only production WIF/deployment isolation.
11. Full public and ACC regression suites.
12. Post-merge release SHA verification.

## Release gates

Module D is complete only when:

- feature head passes public test/typecheck/lint/build;
- feature head passes ACC test/typecheck/lint/build;
- no recovery route can authenticate as production deployer from feature/release branch;
- no service-account JSON/Firebase token fallback is introduced;
- recovery collections remain client-denied;
- exact feature head is green in PR CI;
- PR merges only to `release/v1.0` with exact-head guard;
- exact release merge SHA is green post-merge;
- `main` SHA remains unchanged;
- no production Firebase deploy/restore/import/cutover occurs as part of Module D feature/release integration.

## Non-goals and deferred operations

Deferred outside Module D v1 unless separately approved:

- automatic production database cutover;
- automatic DNS/Vercel environment switch to a recovery database;
- autonomous restore triggered by error counts;
- cross-region custom replication engine;
- document-by-document custom backup engine;
- retention-policy administration UI for all Google Cloud backup policies if provider setup already manages it externally.

## Acceptance statement

A successful Module D release gives the project a controlled, auditable recovery plane: failures degrade safely, admins can enter Safe Mode, create/inspect checkpoints, prepare restores into isolated recovery databases, validate candidates, and produce a trustworthy recovery decision without exposing secrets or allowing feature/release branches to mutate production deployment authority.
