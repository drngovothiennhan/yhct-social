# Beta 2.0 Module A — RBAC, MSSV Provisioning & Independent ACC

## Scope

Module A upgrades YHCT Social from the v1.0 role model to a four-level club hierarchy and adds a separately deployable Admin Control Center (ACC). It preserves the v1.0 public app and Firebase project while isolating privileged operations from the client newsfeed build.

## Baseline

- Canonical web application remains Next.js 16.3.4 + React 19.2.8 + Tailwind 4.3.3. We do not downgrade the existing stable stack to Next.js 14.
- Firebase project remains `yhct-social-260902-42a4`.
- Production web remains `https://yhct-social.vercel.app`.
- Existing v1.0 roles are `member | moderator | admin`; Beta 2.0 introduces `member | mod | super_mod | admin` with a compatibility bridge for legacy `moderator` during migration.

## Organizational RBAC

Role order is:

1. `admin` — Club President / full authority.
2. `super_mod` — Vice President / all moderation plus member-management authority except irreversible platform-owner actions.
3. `mod` — management board / specialist team leaders; content moderation and assigned member workflows.
4. `member` — normal member.

Firebase Custom Claims are authoritative for privileged server actions. Firestore `users/{uid}.role` mirrors the claim for rendering and querying only. Firestore Security Rules reject privilege escalation from clients.

Claims:

```json
{
  "role": "member|mod|super_mod|admin",
  "clubMember": true,
  "mustChangePassword": true|false
}
```

The server refreshes claims whenever Admin changes a role. The user must refresh the Firebase ID token before new rights take effect.

## MSSV authentication and provisioning

Firebase email/password requires an email-shaped identifier, therefore MSSV login is normalized internally to `<mssv>@members.yhct.hiu.vn`. The UI accepts plain MSSV and does not require users to type the synthetic domain.

The source CSV supplied for this module contains 174 source rows and 159 unique MSSV values. There are 15 duplicated MSSV groups, five groups with conflicting source names, and four groups with title differences. Provisioning therefore deduplicates by normalized MSSV, chooses the highest privilege represented by duplicate title rows, keeps the first stable non-empty display name, and records source-conflict flags for ACC review rather than silently discarding the audit condition. Phone numbers are excluded from Auth and provisioning output.

Initial deduplicated role projection from the supplied roster is:

- admin: 1
- super_mod: 2
- mod: 8
- member: 148

Title-to-role mapping:

- `Chủ Nhiệm` variants -> `admin`
- `Phó Chủ Nhiệm` variants -> `super_mod`
- `Ban quản lý` -> `mod`
- `Thành viên`, blank and other non-privileged titles -> `member`

Titles are stored separately from RBAC and remain editable by Admin after import.

The system MUST NOT use MSSV itself as a password. Each seeded account receives a cryptographically random one-time activation password. The private activation export is never committed to the public repository. `mustChangePassword=true` is set on creation. After the user changes the password, the independent ACC endpoint verifies the Firebase ID token and clears the claim.

Provisioning is idempotent: re-running a seed updates mirror metadata/claims for the same synthetic email instead of creating duplicate Auth accounts.

## Independent Admin Control Center

`admin-portal/` is a separate Next.js application with its own `package.json`, build and deployment. It is deployed as a separate Vercel project so failure of the public newsfeed build does not remove administrative access.

ACC authentication flow:

1. Browser signs in using the same Firebase Auth tenant/project.
2. Browser sends Firebase ID token to ACC API.
3. ACC server verifies token using Firebase Admin SDK.
4. ACC reads authoritative Custom Claims and applies a permission matrix.
5. Privileged changes are performed only by server-side Admin SDK calls.

The ACC runtime uses Vercel OIDC -> Google Cloud Workload Identity Federation. No long-lived service-account JSON key is committed or required. A dedicated ACC runtime service account will have only the Firebase Auth/Firestore permissions required by Module A.

## Module A ACC capabilities

The first ACC release includes:

- member search/list with role/title/provisioning state,
- role and title update,
- disable/enable Firebase Auth user,
- practitioner verification review status update,
- maintenance-mode read/write switch,
- system health panel.

Backup/restore implementation remains Module D; Module A exposes the isolated ACC shell and permission boundary so those controls can be added without depending on the public client.

## Data model additions

`users/{uid}` adds or normalizes:

- `role`: `member | mod | super_mod | admin`
- `professionalTitle`: existing field, Admin editable
- `memberCode`: MSSV for provisioned club members
- `provisioningSource`: `roster | open_registration | migrated`

`users/{uid}/private/access`:

- `memberCode`
- `syntheticEmail`
- `mustChangePassword`
- `sourceConflict`
- `sourceImportedAt`
- `disabled`

`system/config`:

- `maintenanceMode`
- `maintenanceMessage`
- `updatedAt`
- `updatedBy`

## Permission matrix

- `member`: own profile-safe fields only.
- `mod`: moderation workflows; no role assignment, no Auth disable.
- `super_mod`: moderation + member management + verification review; cannot promote anyone to `admin` or change another `admin`.
- `admin`: all Module A ACC actions, including assigning `super_mod`/`mod`, changing titles and account disable/enable.

No client can directly set its own role or claim.

## Security rules

Firestore rules use claim-first authorization for privileged writes and maintain compatibility with legacy v1.0 moderator documents during the migration window. A client can never write `memberCode`, `provisioningSource`, `role`, `professionalTitle`, or private access records.

## Tests and acceptance

Module A is accepted only when all of the following are fresh green evidence:

- RBAC hierarchy unit tests.
- self-promotion and privilege-escalation denial tests.
- provisioning parser/deduplication tests against non-PII fixtures.
- idempotent Auth provisioning tests with mocked Admin interfaces.
- MSSV login normalization tests.
- ACC token/claim authorization tests.
- Firestore rule-contract tests for `mod`, `super_mod`, `admin`.
- root v1.0 test/typecheck/lint/build remains green.
- independent `admin-portal` test/typecheck/lint/build is green.
- no roster PII or activation password is committed to Git.
