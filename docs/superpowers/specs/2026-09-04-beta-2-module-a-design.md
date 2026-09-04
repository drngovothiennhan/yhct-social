# YHCT Social Beta 2.0 — Module A Architecture

## Scope

Module A upgrades YHCT Social from the v1.0 role model into a secure club provisioning and administration platform. It delivers three independently testable subsystems:

1. Hybrid RBAC using Firebase Auth Custom Claims as the authoritative privilege source.
2. Bulk student provisioning by MSSV with one-time activation credentials and mandatory password change.
3. An independently deployable Admin Control Center (ACC) that can remain operational even if the public newsfeed application fails.

Module A does not include the Beta 2.0 portal visual redesign, reactions, AI features, or backup/restore engine beyond the ACC interfaces required for later Module D integration.

## Current baseline

The existing app uses `member | moderator | admin` in Firestore profile documents and client-side Firebase Auth. Firestore rules currently resolve moderator/admin authority from `users/{uid}.role`. The production Firebase project is `yhct-social-260902-42a4`, and v1.0 production is hosted through the `HIU YHCT` Vercel workspace.

## Source roster assessment

The provided club roster contains 174 non-empty member rows and 159 unique MSSV values. There are 15 duplicate MSSV rows. The provisioning pipeline must deduplicate by normalized MSSV and reject conflicting duplicates rather than silently creating multiple Firebase accounts.

Observed title values include Chủ nhiệm, Phó chủ nhiệm, Ban quản lý, Thành viên, and blank variants. Titles are administrative display metadata only; they must never directly grant permissions.

## Security decisions

### Authoritative RBAC

The authoritative role hierarchy is:

`admin > super_mod > mod > member`

Firebase Auth Custom Claims are authoritative for privileged server operations. Firestore profile fields mirror role only for display and rule compatibility during migration.

Required claims:

- `role`: `admin | super_mod | mod | member`
- `clubMember`: boolean
- `mustChangePassword`: boolean

No client is allowed to write or elevate these claims. Only ACC server routes and controlled provisioning scripts using Firebase Admin SDK may assign them.

### Separation of role and title

`role` controls permissions. `professionalTitle` and `clubTitle` are human-facing labels editable by Admin. Changing `clubTitle` must not change `role`; changing `role` must be an explicit privileged action.

Initial role inference from the provided roster is deterministic:

- `Chủ nhiệm` -> `admin`
- `Phó chủ nhiệm` -> `super_mod`
- `Ban quản lý` -> `mod`
- all other titles or blanks -> `member`

After provisioning, Admin may change both role and title independently in ACC.

### MSSV login alias

Firebase Auth uses email identifiers, so the canonical member login alias is:

`<normalized-mssv>@member.yhct-clb.local`

The UI may accept either the raw MSSV or the canonical alias. Raw MSSV input is normalized to the alias before calling Firebase Auth.

### Activation credentials

The insecure pattern `password = MSSV` is prohibited. Each provisioned account receives a cryptographically random one-time activation password. `mustChangePassword=true` is set until the user successfully changes it. Privileged and member-only routes must reject users whose claim still requires password rotation, except the dedicated password-change flow.

The activation password is never committed to Git and is never stored in Firestore after delivery/export. Provisioning output containing activation credentials is treated as a private artifact.

## Data model

### `users/{uid}`

Public/authenticated profile fields continue to hold display-oriented data. Module A extends the profile contract with:

- `clubTitle: string`
- `studentId: string`
- `role: 'member' | 'mod' | 'super_mod' | 'admin'`
- `accountStatus: 'active' | 'disabled'`

`role` is a mirror of the claim and is never trusted by ACC server routes for authorization.

### `users/{uid}/private/access`

Private access metadata:

- `studentId`
- `loginAlias`
- `provisionedAt`
- `provisioningSource`
- `mustChangePassword`
- `lastPasswordChangedAt`
- `disabledReason`

Read access: owner plus `mod/super_mod/admin` as appropriate. Client writes are denied except a narrow password-change completion marker written through server code.

### `clubProvisioning/{studentId}`

Server-managed idempotency ledger:

- `uid`
- `studentId`
- `sourceHash`
- `status`
- `createdAt`
- `updatedAt`

Client read/write is denied. This prevents duplicate Auth accounts across repeated imports.

## Provisioning subsystem

### Input

CSV fields consumed from the supplied roster:

- Họ và tên
- MSSV
- Khoa
- Chức vụ

Phone numbers are not required for authentication and are excluded from the provisioning payload.

### Normalization

- trim Unicode whitespace
- uppercase/normalize display name without destructive transliteration
- MSSV must be digits only after trimming
- title comparison is case-insensitive and accent-tolerant for known club titles
- duplicate MSSV rows are grouped before any write
- exact duplicates collapse to one member
- conflicting duplicates fail validation and are reported without partially provisioning that MSSV

### Idempotency

For each normalized MSSV:

1. Check `clubProvisioning/{studentId}`.
2. If already bound to a Firebase UID, update allowed profile/title metadata only when explicitly requested.
3. Otherwise create the Auth user, set Custom Claims, create profile/private docs, then write the idempotency ledger.
4. Every write path is retry-safe.

## ACC architecture

The Admin Control Center is a separate deployable Next.js application in the same repository, under `apps/admin-portal`, with its own `package.json`, build, and Vercel project.

It does not import public newsfeed UI components. Shared domain types may be imported from a small framework-agnostic package only.

### Server authentication

ACC browser obtains a Firebase ID token. Every privileged route verifies the token with Firebase Admin SDK and reads Custom Claims. No route trusts role data sent in the request body or Firestore profile.

### Runtime credentials

ACC server obtains Google Cloud credentials without committed long-lived service-account JSON. Production deployment uses Vercel OIDC with Google Cloud Workload Identity Federation and a dedicated least-privilege runtime service account.

### Module A ACC capabilities

- list/search members
- inspect account status and verification state
- change role
- change club title
- disable/enable Firebase Auth account
- review practitioner verification submissions
- expose maintenance-state control interface for Module D integration
- health endpoint that validates Firebase Admin connectivity

Backup/restore execution is deferred to Module D, but ACC must expose isolated navigation and permission boundaries so those controls can be added without coupling to the public app.

## Permission matrix

### admin

- all Module A actions
- assign/remove `super_mod`, `mod`, `member`
- cannot accidentally remove the final active admin without an explicit protected transfer flow

### super_mod

- list/search members
- disable/enable non-admin/non-super-mod accounts
- review practitioner verification
- edit titles for mod/member accounts
- cannot assign admin or super_mod

### mod

- list/search member profiles needed for club operations
- review practitioner evidence if granted the verification permission set
- cannot change roles
- cannot disable accounts

### member

- no ACC access

## Firestore rules migration

Rules must be migrated from the legacy `moderator` concept to the new role hierarchy while preserving compatibility during Beta 2.0 rollout.

During transition, helper functions may recognize legacy `moderator` as equivalent to `mod`, but all newly provisioned accounts use the new values. Client self-service must never be able to alter role, clubTitle if configured as admin-only, account status, or private access metadata.

## Error handling

- Invalid or conflicting CSV rows fail validation before Auth writes for those rows.
- Provisioning continues for independent valid rows and emits a structured result summary.
- Firebase Auth creation followed by Firestore failure must be detected and retried through the idempotency ledger; duplicate Auth creation is prohibited.
- ACC routes return 401 for invalid/missing token, 403 for insufficient claims, 409 for protected role-transfer conflicts, and structured 4xx validation errors for invalid payloads.
- Sensitive exception details and activation passwords are never returned to browser logs.

## Testing gates

Module A is not accepted unless these tests pass:

1. role hierarchy and permission matrix unit tests
2. self-promotion and role-escalation denial tests
3. legacy `moderator` compatibility tests during migration
4. MSSV normalization and duplicate/conflict tests using a sanitized roster fixture
5. provisioning idempotency tests
6. `mustChangePassword` gate tests
7. ACC route authorization tests using verified claims
8. disable/enable account authorization tests
9. Firestore contract tests for private access and provisioning ledger denial
10. production builds for both public app and `apps/admin-portal`

## Deployment boundaries

- Public application keeps its current production project/domain.
- ACC receives a separate Vercel project and domain.
- A public-app build failure must not block an ACC build/deployment.
- Firebase Auth/Firestore remain shared backend services.
- No roster CSV, activation password list, phone number, or private member artifact is committed to the public repository.

## Acceptance criteria

Module A is complete when:

- the 159 unique roster members can be safely provisioned or reconciled idempotently
- the provided titles are imported as editable metadata
- Admin/Super Mod/Mod/Member permissions are enforced server-side by Custom Claims
- raw MSSV login is accepted by the UI through alias normalization
- first-login password rotation is mandatory
- ACC is independently deployed and can manage members while the public frontend is unavailable
- all listed security, provisioning, rules, and build tests pass
