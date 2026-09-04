# YHCT Social Beta 2.0 — Module C Admin & Moderation Control Plane

## Scope

Module C turns the existing Admin Control Center (ACC) into the operational control plane for moderation, practitioner verification, and auditable privileged actions while preserving the production boundaries established by Modules A and B.

Module C delivers six independently testable product areas:

1. Member-generated reports for posts and comments.
2. A role-gated moderation queue in ACC.
3. Deterministic post/comment moderation actions with soft-delete semantics.
4. Practitioner verification workflow backed by private evidence storage.
5. Append-only privileged audit events.
6. ACC information architecture split into focused operational modules instead of one monolithic dashboard.

Module C does not add private messaging, AI moderation, automated diagnosis, payment, recommendation ranking, push notifications, backup/restore execution, or a second identity system.

## Baseline and branch boundary

The production baseline is merge commit `031a347499ea29330f800c0254437337a46376e0` on `main`.

Module C develops only on `beta/2.0-module-c` until its verification gates are green. Direct feature development on `main` is forbidden.

Existing production boundaries remain authoritative:

- public social application: Next.js App Router deployed as the existing Vercel public project.
- ACC: independent Next.js application under `admin-portal/`, deployed as the existing dedicated admin Vercel project.
- shared backend services: Firebase Auth, Firestore and Firebase Storage in project `yhct-social-260902-42a4`.
- role hierarchy: `member < mod < super_mod < admin`.
- Custom Claims and trusted ACC APIs remain the authority for privileged role checks.
- `mustChangePassword=true` blocks privileged/session-sensitive mutations.
- production Google workload identity remains scoped to the existing `main` trust boundary; Module C must not widen that condition.

## Existing ACC capabilities preserved

Module C builds on, rather than replaces, the existing ACC capabilities:

- ACC email/MSSV login.
- mandatory activation-password rotation.
- member search.
- role management according to existing hierarchy policy.
- club title management.
- practitioner verification status management currently exposed in basic form.
- account disable/enable controls.
- maintenance mode.

The existing capabilities must remain functional and covered by regression gates.

## Product principles

### Trusted privileged mutations

Public browser clients may submit reports and their own verification requests only through fields explicitly allowed by Firestore and Storage Rules. Privileged moderation, verification decisions, role/account actions, and audit writes execute through ACC server routes using Firebase Admin after token verification and role checks.

No public client may write moderation decisions, account roles, Custom Claims, verification decisions, audit events, maintenance state, or server-owned counters.

### Soft delete before destruction

Normal moderation never hard-deletes a post or comment. Content lifecycle continues to use status fields so actions remain reversible and auditable.

Hard deletion is outside Module C except existing cleanup mechanisms for user-owned unpublished media.

### Evidence before authority

Practitioner verification never becomes `verified` solely because the browser requests it. Evidence remains private, and final approval requires `super_mod` or `admin` authority in ACC.

### Append-only administrative history

Every privileged state-changing ACC operation introduced by Module C writes an audit event from trusted server code. Audit records are never editable or deletable from public clients or normal ACC UI.

## Information architecture

The current ACC dashboard is split into focused route-level areas sharing one authenticated shell:

- `/` — operational overview.
- `/members` — member search, roles, club titles, account state.
- `/moderation` — report queue and moderation actions.
- `/verification` — practitioner verification queue and evidence review.
- `/audit` — privileged audit history; admin-only in Module C.
- `/system` — maintenance mode and system-level controls.

The login and mandatory password-rotation experience remain at the ACC entry boundary before the operational shell is rendered.

The public app adds only user-facing report actions and verification-request status/submission surfaces where those flows already belong. It never mounts ACC pages.

## Report model

### `reports/{reportId}`

A report represents one authenticated member flagging one specific post or comment.

Required fields:

- `reporterUid: string`
- `targetType: 'post' | 'comment'`
- `postId: string`
- `commentId: string | null`
- `reasonCode: 'spam' | 'misinformation' | 'inappropriate' | 'privacy' | 'other'`
- `details: string`
- `status: 'open' | 'reviewing' | 'resolved' | 'dismissed'`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`
- `assignedTo: string | null`
- `resolvedBy: string | null`
- `resolvedAt: Timestamp | null`
- `resolution: 'keep' | 'hide' | 'soft_delete' | null`
- `resolutionReason: string | null`

### Report idempotency

Module C uses deterministic report document IDs so a member cannot create duplicate reports for the same exact target.

Canonical IDs:

- post: `post__{postId}__{reporterUid}`
- comment: `comment__{postId}__{commentId}__{reporterUid}`

Firestore Rules validate that `reporterUid == request.auth.uid`, the target identifiers match the document ID contract, and the initial state is `status='open'` with all moderator-owned resolution fields empty.

A reporter cannot change `status`, assignment, resolution, resolver, or timestamps controlled by moderation. Module C treats a report as one durable report record per reporter/target. If a resolved report needs reconsideration, a moderator may reopen it through ACC; the client does not create a second report for the same target.

### Report creation boundary

Only authenticated club members with `mustChangePassword=false` may create reports.

Clients may set only:

- target identifiers.
- allowed `reasonCode`.
- bounded `details`.
- their own `reporterUid`.

Rules or trusted service code set/validate all initial lifecycle fields.

Recommended limits:

- `details`: maximum 2,000 characters.
- reason code must be from the fixed enum.
- report target must reference an existing post/comment that is readable to the reporter at report time where rule constraints permit verification.

## Moderation lifecycle

Posts and comments retain their existing content statuses:

- `active`
- `hidden`
- `deleted`

Module C maps moderation resolutions as follows:

- `keep`: target status does not change; report becomes `resolved`.
- `hide`: target status becomes `hidden`; report becomes `resolved`.
- `soft_delete`: target status becomes `deleted`; report becomes `resolved`.
- `dismiss`: target status does not change; report becomes `dismissed`.

A moderation reason is mandatory for `hide`, `soft_delete`, restore, and verification rejection. ACC also records a reason for `keep`/`dismiss` so decisions are reviewable.

### Restoration

- `mod` may hide or soft-delete active content and may restore content that the same moderator hid during the current operational policy only when no higher-level lock exists.
- `super_mod` and `admin` may restore any Module C moderated post/comment from `hidden` or `deleted` to `active` when policy permits.
- restoration is always audited.

Implementation may simplify the first release by routing all restore operations to `super_mod/admin`; this stricter form is acceptable and preferred if it reduces ambiguous authority.

### Queue states

ACC moderation queue supports:

- open.
- reviewing.
- resolved.
- dismissed.

Default queue view is `open`, ordered oldest-first so reports cannot starve indefinitely. Secondary views may filter by target type, reason code, status, or assignee.

Queries are cursor-based and bounded; no unbounded collection scan is accepted.

## Moderation authority matrix

### `member`

- create one report per exact target.
- read only their own report status if the product UI exposes it.
- cannot perform moderation actions.

### `mod`

- enter ACC after existing claim/session checks.
- read moderation queue.
- assign a report to self where assignment is implemented.
- resolve/dismiss reports.
- hide or soft-delete posts/comments.
- cannot approve practitioner verification.
- cannot modify admin/super_mod authority beyond existing member policy.

### `super_mod`

- all mod moderation permissions.
- resolve escalated reports.
- restore moderated content.
- approve/reject practitioner verification.
- cannot change production system trust boundaries.

### `admin`

- all super_mod permissions.
- existing role/title/account/maintenance authority.
- read full Module C audit log.
- restore content and resolve escalations.

The ACC server must re-check role for every privileged request. Role-aware UI visibility is not authorization.

## ACC server API boundaries

Module C extends the existing `admin-portal/app/api` pattern rather than introducing a second backend framework.

Expected route groups:

- `GET /api/moderation/reports`
- `PATCH /api/moderation/reports/[reportId]`
- `POST /api/moderation/actions`
- `GET /api/verification/requests`
- `GET /api/verification/requests/[uid]`
- `PATCH /api/verification/requests/[uid]`
- `GET /api/audit`

Exact route decomposition may vary during implementation if existing Next.js route conventions make a smaller interface clearer, but responsibilities and authorization boundaries may not be weakened.

Every privileged endpoint must:

1. require a Firebase ID token.
2. verify the token through Firebase Admin.
3. reject `mustChangePassword=true`.
4. require the minimum role for the requested action.
5. validate payload enums, lengths, IDs, and state transition.
6. update target state transactionally where multiple Firestore documents must remain consistent.
7. write an audit event for successful privileged state changes.
8. return sanitized errors without leaking tokens, credentials, private certificate URLs, or server internals.

## Practitioner verification model

### Canonical public profile state

`users/{uid}.verificationStatus` remains the club-facing canonical state:

- `unsubmitted`
- `pending`
- `verified`
- `rejected`

Existing legacy values are normalized during reads/updates without broad destructive migration.

### `verificationRequests/{uid}`

One current verification request document per practitioner candidate.

Expected fields:

- `uid: string`
- `status: 'pending' | 'verified' | 'rejected'`
- `professionalType: string`
- `evidence: VerificationEvidence[]`
- `submittedAt: Timestamp`
- `updatedAt: Timestamp`
- `decidedBy: string | null`
- `decidedAt: Timestamp | null`
- `decisionReason: string | null`
- `attempt: number`

`VerificationEvidence` stores durable private references only, for example:

- `storagePath: string`
- `type: 'certificate' | 'license' | 'other'`
- `label: string`
- `uploadedAt: Timestamp`

Do not store public download URLs for private certificates in Firestore.

### Evidence storage

Verification evidence remains under the existing private certificate/evidence subtree owned by the submitting user. Storage Rules allow the owner to upload/read their own evidence and eligible moderators to read it according to existing private-storage policy.

The public application cannot read another member's evidence.

### Submission and resubmission

A practitioner candidate may create/update their own request only into `pending` using allowed self-service fields and private evidence paths under their own Storage subtree.

After rejection, a user may resubmit by incrementing `attempt`, replacing/adding permitted evidence metadata, clearing prior decision fields, and returning to `pending`. Rules must prevent the client from choosing `verified` or setting `decidedBy/decidedAt`.

### Decision transaction

`super_mod` or `admin` verification decisions update, in one trusted transaction where practical:

1. `verificationRequests/{uid}.status` and decision metadata.
2. `users/{uid}.verificationStatus`.
3. append an `adminAudit` event after/within the trusted operation using a deterministic operation identifier if retry safety requires it.

A failed transaction must not leave the request verified while the public profile remains pending, or the reverse.

## Audit model

### `adminAudit/{eventId}`

Audit records are server-authored, append-only operational evidence.

Required fields:

- `actorUid: string`
- `actorRole: 'mod' | 'super_mod' | 'admin'`
- `action: string`
- `targetType: 'post' | 'comment' | 'report' | 'verification' | 'member' | 'system'`
- `targetId: string`
- `reason: string`
- `before: Record<string, unknown> | null`
- `after: Record<string, unknown> | null`
- `createdAt: Timestamp`
- `operationId: string`

Audit summaries must contain only the minimum state required to reconstruct the administrative decision. They must not duplicate raw certificate files, activation passwords, private phone numbers, ID tokens, service credentials, or other secrets.

### Append-only rule

Public Firestore clients have no create/update/delete permission on `adminAudit`.

Normal ACC UI exposes read access through trusted server APIs only. Module C full audit browsing is admin-only. Server code may additionally return target-specific decision history to lower privileged roles when needed for moderation context, but never the unrestricted audit collection.

`operationId` supports retry-safe audit creation for transactional server actions so a retried API request does not create contradictory duplicate audit entries.

## Data consistency and concurrency

Moderation and verification APIs must reject invalid state transitions rather than blindly overwrite current state.

Examples:

- a resolved report cannot be resolved a second time without an explicit reopen/escalation path.
- a report claimed by another moderator cannot silently lose assignment when optimistic concurrency is used.
- a verification request may be approved only from `pending`.
- moderation of a target already `deleted` returns an idempotent/no-op result or a conflict according to the service contract; it must not create impossible lifecycle states.

Firestore transactions are required when one privileged action changes multiple documents whose states must agree.

## ACC client architecture

The current large `admin-portal/app/dashboard.tsx` is decomposed during Module C because it sits directly in the area being extended.

Expected focused boundaries:

- authenticated ACC shell/navigation.
- login/password-rotation gate.
- member management screen.
- moderation queue screen.
- report detail/action panel.
- practitioner verification queue/detail screen.
- audit screen.
- system screen.
- typed API client utilities.
- domain validation/transition helpers under `admin-portal/lib`.

Route components orchestrate data and presentation. Role/state transition policy belongs in shared policy/domain units and trusted API handlers, not duplicated across buttons.

This is a targeted refactor only. Module C must not rewrite unrelated public social components merely for style consistency.

## Public app changes

Public application changes are deliberately narrow:

- add `Report` action to eligible post/comment UI.
- present reason selection and bounded optional details.
- prevent duplicate submission UX for the deterministic report record.
- show safe success/error feedback.
- expose practitioner verification submission/status only if the existing profile/onboarding structure has the required practitioner state.

No ACC administrative UI or Firebase Admin credential enters the public bundle.

## Firestore Rules requirements

Module C rules must prove at least:

1. unauthenticated users cannot create reports or verification requests.
2. a member cannot report as another UID.
3. a client cannot create a report already marked resolved/dismissed/reviewing.
4. a client cannot change report moderation fields after creation.
5. clients cannot write `adminAudit` at all.
6. users may read/write only their own verification request according to permitted self-service fields.
7. users cannot set verification state to `verified` themselves.
8. verification evidence paths must belong to the submitting UID.
9. existing role/account/provisioning/private-document protections remain intact.
10. existing social post/comment ownership protections remain intact.
11. `mustChangePassword=true` accounts cannot submit sensitive member mutations governed by Module C.

Privileged ACC writes using Firebase Admin do not rely on client Rules for authorization, so API authorization contract tests are mandatory in addition to Firestore Rules tests.

## Storage Rules requirements

Module C must retain private certificate/evidence guarantees:

- evidence owner may upload allowed evidence to their own subtree.
- ordinary members cannot read another member's evidence.
- eligible moderation roles may read evidence only through the intended private policy.
- no public unauthenticated evidence reads.
- size/type limits remain bounded.
- social media rules from Module B remain unchanged unless a tested compatibility adjustment is required.

## Query and index requirements

Likely Module C composite indexes include bounded queue queries such as:

- `reports(status, createdAt asc)`
- `reports(status, targetType, createdAt asc)`
- `reports(status, reasonCode, createdAt asc)`
- `verificationRequests(status, submittedAt asc)`
- `adminAudit(createdAt desc)`
- optional admin audit filters by `targetType` or `actorUid` if UI requires them.

Only indexes required by implemented queries are committed. No speculative index explosion.

## Error handling

ACC must distinguish:

- authentication required.
- password rotation required.
- insufficient role.
- target not found.
- invalid state transition/conflict.
- invalid report/verification payload.
- private evidence unavailable.
- transient Firebase/network failure.

Privileged action buttons are disabled while the same action is in flight. Repeated submissions use idempotent operation IDs or transaction preconditions where necessary.

User-visible messages never include Firebase Admin stack traces, private evidence URLs, ID tokens, workload identity details, or service-account material.

## Performance and scale targets

Module C targets the current club scale of hundreds of members with room for low-thousands without adding unnecessary queue infrastructure.

Requirements:

- pagination/cursors for reports, verification requests, members, and audit history.
- default page sizes bounded to approximately 20–50 records.
- no unbounded `get()` across entire moderation/audit collections in normal ACC pages.
- no N+1 download of private evidence while rendering queue rows; evidence is loaded only on request detail.
- report queue does not attach global realtime listeners unless demonstrated necessary.
- admin audit stores compact summaries, not full content snapshots or files.

## Security and privacy constraints

Module C must never commit or expose:

- service-account JSON.
- activation passwords.
- roster/private migration packages.
- phone/address/private identity lists.
- raw practitioner certificate files.
- private evidence download URLs in public Firestore fields.
- Firebase ID tokens.

Certificate/evidence access remains purpose-limited. Audit records store administrative facts, not a duplicate sensitive-data warehouse.

## Testing strategy

### Public/domain tests

- deterministic report ID generation.
- report validation and length limits.
- report duplicate/idempotent behavior.
- practitioner request validation and self-service transitions.

### Firestore/Storage contract tests

- every Rules invariant listed above.
- regression tests for Module A private provisioning/account fields.
- regression tests for Module B post/comment/reaction/media rules.

### ACC unit/contract tests

- role matrix for mod/super_mod/admin.
- token and `mustChangePassword` gates.
- moderation state machine.
- invalid transition conflicts.
- practitioner decision authority.
- transactional update contracts.
- audit event generation and operation-id idempotency.
- sanitized error responses.

### UI contract/component tests

Where practical:

- ACC route navigation and role-aware visibility.
- report queue loading/empty/error states.
- moderation action confirmation and disabled/busy state.
- verification evidence metadata rendering without public URLs.
- admin-only audit surface.
- public report form validation and duplicate submission state.

### Repository gates

Module C is not accepted unless all are green:

- root `npm test`.
- root `npm run typecheck`.
- root `npm run lint`.
- root production `npm run build`.
- `admin-portal` tests/check/typecheck/lint as defined by its package scripts.
- `admin-portal` production build.
- Firestore/Storage security-contract tests.
- CI on the Module C branch/PR.

## Deployment boundary

Module C changes flow through normal branch/PR integration. Production deployment remains `main`-only.

- public Vercel deploy remains tied to the existing public project.
- ACC deploy remains tied to the dedicated admin project/workflow.
- Firebase Rules/Indexes deploy remains through the existing production workflow.
- Workload Identity Federation remains `github-main` scoped for production.
- no long-lived Google service-account key is introduced.
- no production Firestore migration is required merely to add Module C collections because new documents are created lazily by product workflows.

If a schema backfill becomes demonstrably necessary during implementation, it is a separate migration design/gate and must not be smuggled into a UI deployment.

## Acceptance criteria

Module C is complete when all of the following are verified:

- authenticated members can report eligible posts/comments with deterministic duplicate protection.
- clients cannot control report moderation lifecycle fields.
- mod/super_mod/admin can access the ACC moderation queue according to role.
- authorized moderators can keep, hide, dismiss, or soft-delete reported content without hard deletion.
- invalid moderation transitions are rejected deterministically.
- practitioner candidates can submit/resubmit private evidence without self-verifying.
- only `super_mod/admin` can approve/reject practitioner verification.
- verification request state and public profile verification state remain consistent.
- every Module C privileged state-changing action creates a retry-safe append-only audit event.
- ordinary clients cannot create, update, or delete audit records.
- admin can browse bounded audit history.
- existing member management and maintenance controls still function.
- public app and ACC builds both pass.
- Firestore/Storage rules pass security-contract regression tests.
- Module C reaches production only through the existing `main` production gate; WIF/IAM trust is not broadened.

## Explicitly deferred work

The following require separate specifications and are not part of Module C:

- AI or ML automatic moderation.
- content reputation scoring or shadow banning.
- member-to-member private messaging.
- legal/medical clinical decision automation.
- push/email moderation notifications.
- advanced analytics warehouse.
- bulk CSV moderation/account operations.
- backup/restore execution UI.
- multi-organization tenancy.
- payment/membership billing.
- automated evidence OCR or credential verification against external registries.
