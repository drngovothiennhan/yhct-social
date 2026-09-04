# Beta 2.0 Module A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver four-level club RBAC, secure MSSV provisioning, and an independently buildable Admin Control Center without weakening the v1.0 public app.

**Architecture:** Custom Claims are authoritative for privileged server actions; Firestore profile fields are presentation mirrors. MSSV accounts use synthetic email identifiers and random one-time activation passwords. `admin-portal/` is a separately buildable Next.js app using Firebase Admin SDK on the server and is intended for a separate Vercel project.

**Tech Stack:** TypeScript 5.9.3, Node 22.16, Next.js 16.3.4, React 19.2.8, Firebase 12.18.0, firebase-admin 14.3.0, Tailwind 4.3.3.

**Spec:** `docs/superpowers/specs/2026-09-04-beta-2-module-a-rbac-acc-design.md`

## Global Constraints

- Never commit the supplied roster, phone numbers, activation passwords, Firebase private keys, or service-account JSON.
- Do not use MSSV as a password.
- Role hierarchy is exactly `member < mod < super_mod < admin`.
- Legacy `moderator` is accepted only as a temporary compatibility input and normalizes to `mod`.
- Existing production Firebase project remains `yhct-social-260902-42a4`.
- Root public application must remain green after every task.

---

### Task 1: RBAC domain contract

**Files:**
- Create: `lib/domain/rbac.ts`
- Create: `tests-node/rbac.test.mjs`
- Modify: `lib/types.ts`

**Interfaces:**
- Produces `ClubRole`, `normalizeClubRole()`, `roleRank()`, `hasMinimumRole()`, `canAssignRole()`.

- [ ] Write failing tests for role normalization, ordering, admin assignment, and `super_mod` inability to assign/change `admin`.
- [ ] Run `npm test -- tests-node/rbac.test.mjs` and confirm RED due missing module/exports.
- [ ] Implement minimal role functions and update shared role type.
- [ ] Run the focused test and then `npm run check` until GREEN.

### Task 2: MSSV roster parser and provisioning contract

**Files:**
- Create: `lib/domain/provisioning.ts`
- Create: `tests-node/provisioning.test.mjs`
- Create: `scripts/provision-members.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces `normalizeMemberCode()`, `memberCodeToSyntheticEmail()`, `mapTitleToRole()`, `dedupeRosterRows()`, `generateActivationPassword()`.
- CLI consumes a CSV/JSON file path at runtime and writes no PII into the repository.

- [ ] Write failing tests using synthetic non-PII fixture rows for MSSV normalization, title mapping, duplicate conflict marking, highest-role merge, synthetic email, and activation password properties.
- [ ] Confirm RED.
- [ ] Implement pure parsing/deduplication and secure password generation using Node `crypto`.
- [ ] Implement Admin SDK CLI with project guard, idempotent lookup/create/update, Custom Claims, Firestore mirror/private access writes, and private activation CSV output path supplied by operator.
- [ ] Add `provision:dry-run` and `provision:import` scripts.
- [ ] Run focused tests and `npm run check` GREEN.

### Task 3: MSSV login and forced password-change client flow

**Files:**
- Modify: `lib/auth-service.ts`
- Modify: `components/providers/auth-provider.tsx`
- Create: `tests-node/mssv-auth.test.mjs`

**Interfaces:**
- Produces `normalizeLoginIdentifier()` and exposes `claims`/`mustChangePassword` in auth context.

- [ ] Write failing tests showing plain numeric MSSV becomes the synthetic email while ordinary email remains unchanged.
- [ ] Confirm RED.
- [ ] Implement identifier normalization and token claim loading/refresh.
- [ ] Preserve Google and normal email/password flows.
- [ ] Run focused tests and full root check GREEN.

### Task 4: Firestore claim-first security model

**Files:**
- Modify: `firestore.rules`
- Modify: `tests-node/rules-contract.test.mjs`

**Interfaces:**
- Custom Claims `role`, `clubMember`, `mustChangePassword` become authoritative for privileged rule helpers.

- [ ] Add failing contract tests for `mod`, `super_mod`, `admin`, legacy moderator compatibility, self-promotion denial, protected memberCode/provisioning fields, and private access denial.
- [ ] Confirm RED against existing rules.
- [ ] Add claim-first helpers with legacy profile fallback only for the migration window.
- [ ] Restrict client profile field mutation accordingly.
- [ ] Run focused tests and full root check GREEN.

### Task 5: Independent Admin Control Center application

**Files:**
- Create: `admin-portal/package.json`
- Create: `admin-portal/tsconfig.json`
- Create: `admin-portal/next.config.ts`
- Create: `admin-portal/app/layout.tsx`
- Create: `admin-portal/app/page.tsx`
- Create: `admin-portal/app/globals.css`
- Create: `admin-portal/lib/admin-auth.ts`
- Create: `admin-portal/lib/rbac.ts`
- Create: `admin-portal/lib/firebase-admin.ts`
- Create: `admin-portal/app/api/health/route.ts`
- Create: `admin-portal/app/api/members/route.ts`
- Create: `admin-portal/app/api/members/[uid]/route.ts`
- Create: `admin-portal/app/api/system/maintenance/route.ts`
- Create: `admin-portal/tests/rbac.test.mjs`

**Interfaces:**
- Every privileged route consumes `Authorization: Bearer <Firebase ID token>`.
- `requireRole(request, minimumRole)` verifies Firebase token then checks Custom Claims.

- [ ] Write failing ACC authorization tests first.
- [ ] Confirm RED.
- [ ] Build minimal independent app, Admin SDK initialization, authorization helper, health/member/maintenance APIs, and management dashboard shell.
- [ ] Ensure `super_mod` cannot assign `admin`; only `admin` can disable accounts or promote to `super_mod/admin`.
- [ ] Run ACC tests/typecheck/lint/build GREEN independently.

### Task 6: CI and isolated deployment contract

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy-admin-portal.yml`

**Interfaces:**
- Root CI validates root app and `admin-portal` independently.
- ACC deployment consumes dedicated Vercel project identifiers and a token from Actions secrets, with no service-account JSON.

- [ ] Add CI validation for `admin-portal` install/check/build.
- [ ] Add a production ACC workflow whose environment contract requires dedicated `ACC_VERCEL_PROJECT_ID` plus existing Vercel token and Firebase public configuration.
- [ ] Add smoke test of the deployed ACC health endpoint.
- [ ] Verify workflow YAML via CI.

### Task 7: Real roster dry-run and acceptance

**Files:**
- No roster committed.
- Runtime input: operator-supplied CSV only.

**Interfaces:**
- Expected supplied roster observation: 174 source rows, 159 unique MSSV, projected roles `admin=1, super_mod=2, mod=8, member=148`.

- [ ] Run provisioning CLI in `--dry-run` against the supplied CSV from a private runtime location.
- [ ] Verify it reports 159 unique accounts and conflict summary without printing names/phones.
- [ ] Do not execute real Auth account creation until dry-run, rules, root CI and ACC CI are all green.
- [ ] Produce final Module A verification report with exact test/build evidence and remaining infrastructure action, if any, for the dedicated ACC Vercel project/WIF identity.
