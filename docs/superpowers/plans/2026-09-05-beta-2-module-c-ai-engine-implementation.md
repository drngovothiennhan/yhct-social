# Beta 2.0 Module C — AI Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Beta 2.0 Module C AI Engine: server-only Gemini integration, advisory moderation/classification, internal and external RAG, DOCX-to-post drafting, hardware-adaptive Lite Mode, and strict privacy/free-tier controls.

**Architecture:** Public AI requests enter typed Next.js server routes backed by one server-only Gemini adapter, privacy/quota guards, and schema validation. ACC remains the independent administrative plane for knowledge-source synchronization and AI operational review. AI-generated records are server-owned; public clients never receive provider secrets/store IDs and never write AI analysis/quota/RAG metadata directly.

**Tech Stack:** Next.js App Router, TypeScript 5.9, React 19, Firebase/Auth/Firestore/Admin, `@google/genai`, `zod`, `mammoth`, Vercel OIDC/WIF for Google server credentials, Node test runner, ESLint.

**Spec:** `docs/superpowers/specs/2026-09-05-beta-2-module-c-ai-engine-design.md`

## Global Constraints

- Use the repository's current compatible Next.js/TypeScript runtime; do not downgrade framework versions merely to match the historical Next.js 14 baseline.
- Gemini calls are server-only. `NEXT_PUBLIC_GEMINI_API_KEY` and any other browser-exposed Gemini secret are forbidden.
- Do not add service-account JSON credentials or Firebase token fallbacks.
- Production Firebase authentication/deployment remains main-only OIDC/WIF. Feature/release branches may validate but must not deploy production.
- AI moderation is advisory only; it cannot directly hide/delete content, suspend users, alter RBAC, or approve practitioner verification.
- Internal and external RAG are separate route contracts and are never silently mixed.
- Do not send MSSV/provisioning credentials, email/account credentials, CCCD/government IDs, practitioner certificate evidence, private ACC/audit data, identifiable patient data, or unrelated private member data to free-tier Gemini.
- Clinical-case AI processing is allowed only after de-identification validation.
- AI/provider failure must not break authentication, manual posting, feed rendering, or ACC core administration.
- Module C completion requires root and ACC `test`, `typecheck`, `lint`, and production `build` gates on the exact final feature SHA.

---

## File Structure Locked by This Plan

### Public/root application

- `lib/server/firebase-admin.ts` — root-app server credential/auth/firestore access; mirrors ACC OIDC/WIF approach without exporting secrets client-side.
- `lib/server/ai/config.ts` — validated Gemini model/quota configuration.
- `lib/server/ai/gemini.ts` — the only root-app Gemini SDK adapter.
- `lib/server/ai/privacy.ts` — sensitive-data/de-identification checks and safe text normalization.
- `lib/server/ai/quota.ts` — request ceilings, deterministic cache keys, and quota decisions.
- `lib/server/ai/auth.ts` — bearer Firebase ID-token verification and mutation eligibility checks.
- `lib/server/ai/types.ts` — Zod schemas and stable AI route/result types.
- `lib/server/ai/analysis.ts` — advisory post analysis persistence/cache service.
- `lib/server/ai/rag.ts` — internal/external query orchestration and source normalization.
- `lib/server/ai/docx.ts` — DOCX validation/extraction/structured draft parsing.
- `app/api/ai/analyze-post/route.ts` — post moderation/classification API.
- `app/api/ai/rag/internal/route.ts` — internal knowledge query API.
- `app/api/ai/rag/external/route.ts` — external grounded query API.
- `app/api/ai/document-to-post/route.ts` — DOCX draft API.
- `lib/hardware-mode.ts` — pure device-signal classification.
- `components/providers/hardware-mode-provider.tsx` — browser signal collection/local override.
- `components/portal/ai-research-panel.tsx` — internal/external academic query UX.
- `components/portal/docx-post-draft.tsx` — DOCX draft upload/review handoff.
- `components/portal/social-composer.tsx` — integrates AI suggestions and DOCX draft without changing canonical post mutation authority.
- `components/portal/portal-shell.tsx` — exposes AI research and visual-mode controls without coupling core rendering to provider availability.
- `app/layout.tsx` — mounts hardware-mode provider only.

### ACC

- `admin-portal/lib/ai-policy.ts` — ACC AI role policies.
- `admin-portal/lib/ai-knowledge.ts` — Drive/File Search manifest sync/remove/idempotency service.
- `admin-portal/lib/ai-ops.ts` — bounded AI analysis/quota status reads.
- `admin-portal/app/api/ai/health/route.ts` — secret-free AI configuration health.
- `admin-portal/app/api/ai/analyses/route.ts` — bounded moderation-analysis queue.
- `admin-portal/app/api/ai/knowledge/route.ts` — source manifest list.
- `admin-portal/app/api/ai/knowledge/sync/route.ts` — role-checked source sync.
- `admin-portal/app/api/ai/knowledge/[sourceId]/route.ts` — super_mod/admin destructive removal.
- `admin-portal/app/ai/page.tsx` — ACC AI section.
- `admin-portal/app/components/ai-control-center.tsx` — AI health/analysis/source/quota UI.
- `admin-portal/app/acc-shell.tsx` — adds AI navigation.

### Firebase/config/tests

- `.env.example` and `admin-portal/.env.example` — server-only AI/Drive configuration names, no real secrets.
- `package.json`, `package-lock.json`, `admin-portal/package.json`, `admin-portal/package-lock.json` — required SDK/parser/schema/Google API dependencies only.
- `firestore.rules` — server-owned AI collections denied to direct clients.
- `firestore.indexes.json` — only indexes required by bounded ACC queries.
- `tests-node/module-c-ai-*.test.mjs` — root contracts/domain tests.
- `admin-portal/tests/module-c-ai-*.test.mjs` — ACC policy/API/sync contracts.
- `.github/workflows/ci.yml` and validation workflow only if necessary for new tests; never widen deploy trust.
- `README.md` — Module C environment, privacy, operations, and degraded-mode documentation after all gates pass.

---

### Task 1: AI Foundation, Server Auth, Configuration, and Stable Schemas

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Create: `lib/server/firebase-admin.ts`
- Create: `lib/server/ai/config.ts`
- Create: `lib/server/ai/auth.ts`
- Create: `lib/server/ai/types.ts`
- Test: `tests-node/module-c-ai-foundation.test.mjs`

**Interfaces:**
- Produces: `getRootAdminApp()`, `rootAdminAuth()`, `rootAdminDb()`.
- Produces: `getAiConfig(): AiConfig` with `fastModel`, optional `reasoningModel`, `dailyRequestLimit`, `perUserWindowLimit`, `maxTextChars`, `maxDocxBytes`.
- Produces: `requireAiUser(request: Request): Promise<AiActor>` where `AiActor = { uid: string; role: 'member'|'mod'|'super_mod'|'admin'; clubMember: boolean; mustChangePassword: boolean }`.
- Produces Zod schemas: `PostAnalysisInputSchema`, `RagQueryInputSchema`, `DocxDraftSchema`, `AiSourceSchema`, plus inferred TypeScript types.

- [ ] **Step 1: Write RED foundation contracts**

Create `tests-node/module-c-ai-foundation.test.mjs` asserting:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const env = fs.readFileSync('.env.example', 'utf8');
const config = fs.readFileSync('lib/server/ai/config.ts', 'utf8');
const auth = fs.readFileSync('lib/server/ai/auth.ts', 'utf8');

test('Module C uses current Gemini SDK and keeps its key server-only', () => {
  assert.ok(pkg.dependencies['@google/genai']);
  assert.ok(pkg.dependencies.zod);
  assert.ok(pkg.dependencies.mammoth);
  assert.match(env, /^GEMINI_API_KEY=/m);
  assert.doesNotMatch(env, /NEXT_PUBLIC_GEMINI/i);
  assert.match(config, /GEMINI_MODEL_FAST/);
  assert.match(auth, /verifyIdToken/);
});
```

- [ ] **Step 2: Run RED test**

Run: `npm test -- --test-name-pattern="Module C uses current Gemini SDK"`

Expected: FAIL because dependencies/files do not yet exist.

- [ ] **Step 3: Add dependencies and environment contract**

Install runtime dependencies with exact lockfile updates:

```bash
npm install @google/genai zod mammoth google-auth-library @vercel/oidc
```

Add only names/default-safe values to `.env.example`:

```dotenv
GEMINI_API_KEY=
GEMINI_MODEL_FAST=gemini-2.5-flash
GEMINI_MODEL_REASONING=
GEMINI_FILE_SEARCH_STORE=
AI_DAILY_REQUEST_LIMIT=200
AI_PER_USER_WINDOW_LIMIT=10
AI_MAX_TEXT_CHARS=24000
AI_MAX_DOCX_BYTES=5242880
```

- [ ] **Step 4: Implement server credential/auth/config/schema foundation**

Implement `lib/server/firebase-admin.ts` using `@vercel/oidc` + `google-auth-library` on Vercel and `applicationDefault()` locally, following ACC's current credential structure. Do not read JSON credential env vars.

Implement `requireAiUser()` so missing/invalid bearer token returns a normalized auth error and `mustChangePassword === true` is rejected for mutable AI operations.

Define schemas with bounded strings/arrays. `RagQueryInputSchema.query` max 4,000 chars; post-analysis input max from `AI_MAX_TEXT_CHARS`; `DocxDraftSchema.herbs` max 64; `tags` max 12; `uncertainties` max 20.

- [ ] **Step 5: Run foundation tests and typecheck**

Run: `npm test -- --test-name-pattern="Module C" && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add package.json package-lock.json .env.example lib/server tests-node/module-c-ai-foundation.test.mjs
git commit -m "feat(module-c): add server AI foundation"
```

---

### Task 2: Privacy Boundary, De-identification Guard, Quota, and Deterministic Cache Keys

**Files:**
- Create: `lib/server/ai/privacy.ts`
- Create: `lib/server/ai/quota.ts`
- Test: `tests-node/module-c-ai-privacy.test.mjs`
- Test: `tests-node/module-c-ai-quota.test.mjs`

**Interfaces:**
- Consumes: `AiActor`, `AiConfig` from Task 1.
- Produces: `assertAiSafeText(input: { text: string; clinicalCase?: boolean }): { sanitized: string; contentHash: string }`.
- Produces: `makeAiCacheKey(kind: string, contentHash: string, modelVersion: string): string`.
- Produces: `consumeAiQuota(actor: AiActor, operation: AiOperation): Promise<QuotaDecision>` with `QuotaDecision = { allowed: boolean; reason?: 'user_window'|'daily_global'; remaining?: number }`.

- [ ] **Step 1: Write RED sensitive-data contracts**

Cover deterministic rejection of obvious credential/identity payloads using labeled patterns and clinical-case identifiers. Tests must include MSSV/e-mail labels, CCCD-like values, password labels, certificate evidence markers, and a clinical case containing a patient full-name/phone marker.

Example:

```js
assert.throws(() => assertAiSafeText({ text: 'MSSV: 22123456; mật khẩu: 22123456' }), /AI_SENSITIVE_DATA/);
assert.throws(() => assertAiSafeText({ text: 'Bệnh nhân Nguyễn Văn A, SĐT 0901234567', clinicalCase: true }), /AI_CLINICAL_NOT_DEIDENTIFIED/);
```

- [ ] **Step 2: Run RED privacy tests**

Run: `node --experimental-strip-types --test tests-node/module-c-ai-privacy.test.mjs`

Expected: FAIL because privacy functions do not exist.

- [ ] **Step 3: Implement bounded privacy/de-identification guard**

Implement deterministic checks only; do not claim perfect PII detection. Reject high-confidence labeled/private patterns and require clinical-case de-identification markers/rules already enforced by the social model. Normalize whitespace before hashing with Node `crypto.createHash('sha256')`.

- [ ] **Step 4: Write RED quota/cache tests**

Test that same normalized content yields same hash/cache key, different content changes it, and quota decisions reject after configured per-user/global thresholds without calling provider code.

- [ ] **Step 5: Implement server-owned Firestore quota counters**

Use `aiQuotaDaily/{yyyy-mm-dd}` and `aiQuotaWindows/{uid}__{windowKey}` in Firestore transactions. No client writes. Window key is deterministic UTC time bucket; all numeric limits come from config.

- [ ] **Step 6: Run Task 2 tests**

Run: `node --experimental-strip-types --test tests-node/module-c-ai-privacy.test.mjs tests-node/module-c-ai-quota.test.mjs && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add lib/server/ai/privacy.ts lib/server/ai/quota.ts tests-node/module-c-ai-privacy.test.mjs tests-node/module-c-ai-quota.test.mjs
git commit -m "feat(module-c): enforce AI privacy and quota boundaries"
```

---

### Task 3: Gemini Adapter and Advisory Post Analysis API

**Files:**
- Create: `lib/server/ai/gemini.ts`
- Create: `lib/server/ai/analysis.ts`
- Create: `app/api/ai/analyze-post/route.ts`
- Test: `tests-node/module-c-ai-analysis.test.mjs`
- Test: `tests-node/module-c-ai-route-contract.test.mjs`

**Interfaces:**
- Consumes: Task 1 schemas/auth/config; Task 2 privacy/quota/cache utilities.
- Produces: `analyzePost(input: PostAnalysisInput, actor: AiActor): Promise<PostAnalysisResult>`.
- Produces: `GeminiProvider` interface with `generateStructured<T>(request: GeminiStructuredRequest<T>): Promise<T>` so tests inject a fake provider without network calls.
- Persists deterministic `aiAnalyses/{analysisId}` keyed by target + content hash + analysis kind.

- [ ] **Step 1: Write RED provider-seam test**

Require one SDK adapter file only and assert `analysis.ts` does not instantiate `GoogleGenAI` directly.

- [ ] **Step 2: Write RED advisory-authority test**

Use a fake provider returning `{ category:'clinical', confidence:0.92, safetySignals:['harassment'], rationale:'...' }` and assert the service returns/persists analysis but imports/calls no moderation mutation service.

- [ ] **Step 3: Implement Gemini structured adapter**

Instantiate `GoogleGenAI` only inside `lib/server/ai/gemini.ts`; use server config and JSON-schema/Zod-compatible structured output. Normalize provider errors into `AI_PROVIDER_UNAVAILABLE`, `AI_PROVIDER_INVALID_OUTPUT`, or `AI_PROVIDER_QUOTA` without raw stack/provider body exposure.

- [ ] **Step 4: Implement analysis caching/persistence**

`analyzePost()` flow: auth already resolved -> privacy guard -> quota -> deterministic analysis ID -> Firestore cache read -> provider call only on miss -> Zod validation -> server-owned write -> return result with `cacheHit`.

- [ ] **Step 5: Implement `/api/ai/analyze-post`**

Parse `Authorization: Bearer <Firebase ID token>`, validate JSON body, reject password-change gate, call service, and map known errors to bounded HTTP statuses (`400`, `401`, `403`, `413`, `429`, `503`).

- [ ] **Step 6: Run Task 3 tests**

Run: `node --experimental-strip-types --test tests-node/module-c-ai-analysis.test.mjs tests-node/module-c-ai-route-contract.test.mjs && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add lib/server/ai/gemini.ts lib/server/ai/analysis.ts app/api/ai/analyze-post tests-node/module-c-ai-analysis.test.mjs tests-node/module-c-ai-route-contract.test.mjs
git commit -m "feat(module-c): add advisory Gemini post analysis"
```

---

### Task 4: Internal RAG Knowledge Manifest and ACC Sync Control Plane

**Files:**
- Modify: `admin-portal/package.json`
- Modify: `admin-portal/package-lock.json`
- Modify: `admin-portal/.env.example`
- Create: `admin-portal/lib/ai-policy.ts`
- Create: `admin-portal/lib/ai-knowledge.ts`
- Create: `admin-portal/app/api/ai/knowledge/route.ts`
- Create: `admin-portal/app/api/ai/knowledge/sync/route.ts`
- Create: `admin-portal/app/api/ai/knowledge/[sourceId]/route.ts`
- Test: `admin-portal/tests/module-c-ai-policy.test.mjs`
- Test: `admin-portal/tests/module-c-ai-knowledge.test.mjs`

**Interfaces:**
- Consumes: existing `requireAccRole()`/Firebase Admin/OIDC helpers.
- Produces: `canSyncAiKnowledge(role): boolean` for `mod|super_mod|admin`; `canDeleteAiKnowledge(role): boolean` for `super_mod|admin` only.
- Produces: `syncDriveSource(input, actor): Promise<KnowledgeSyncResult>` and `removeKnowledgeSource(sourceId, actor): Promise<void>`.
- Persists `aiKnowledgeSources/{sourceId}` manifest with source ID/hash/provider document ID/status/timestamps but no OAuth token or raw private path.

- [ ] **Step 1: Write RED role-policy tests**

Assert `mod` can sync/re-sync but cannot delete; `super_mod`/`admin` can delete; `member` cannot access ACC AI controls.

- [ ] **Step 2: Add ACC dependencies/config**

Install only what ACC needs for Gemini File Search/Drive access if not already present:

```bash
cd admin-portal && npm install @google/genai zod googleapis
```

Add blank/non-secret config names such as `GEMINI_API_KEY`, `GEMINI_FILE_SEARCH_STORE`, `AI_DRIVE_FOLDER_ID` to `admin-portal/.env.example` without `NEXT_PUBLIC_` prefixes.

- [ ] **Step 3: Implement Drive/File Search adapter behind test seams**

Create injectable interfaces for Drive listing/download and Gemini File Search upload/delete. Production implementation obtains Google credentials server-side and never accepts credential JSON from request bodies/env fallbacks.

`sourceId` must be deterministic from Drive file ID; `contentHash`/version metadata prevents duplicate uploads. A re-sync with unchanged hash returns `unchanged` without provider upload.

- [ ] **Step 4: Implement ACC routes**

All routes call existing ACC server auth. List/sync require `mod`; delete requires `super_mod`. Require non-password-change session. Return bounded results only.

- [ ] **Step 5: Run Task 4 ACC tests**

Run: `cd admin-portal && npm test -- --test-name-pattern="Module C AI" && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add admin-portal/package.json admin-portal/package-lock.json admin-portal/.env.example admin-portal/lib/ai-policy.ts admin-portal/lib/ai-knowledge.ts admin-portal/app/api/ai/knowledge admin-portal/tests/module-c-ai-policy.test.mjs admin-portal/tests/module-c-ai-knowledge.test.mjs
git commit -m "feat(module-c): add internal RAG knowledge sync control plane"
```

---

### Task 5: Internal and External RAG Query APIs

**Files:**
- Create: `lib/server/ai/rag.ts`
- Create: `app/api/ai/rag/internal/route.ts`
- Create: `app/api/ai/rag/external/route.ts`
- Test: `tests-node/module-c-ai-rag.test.mjs`

**Interfaces:**
- Consumes: Gemini adapter, auth/privacy/quota, `RagQueryInputSchema`.
- Produces: `queryInternalRag(input, actor): Promise<RagAnswer>` and `queryExternalRag(input, actor): Promise<RagAnswer>`.
- `RagAnswer = { mode:'internal'|'external'; answer:string; sources:Array<{ id:string; title:string; uri?:string }>; grounded:boolean; degraded?:boolean }`.

- [ ] **Step 1: Write RED route-separation tests**

Assert internal route invokes File Search configuration only and never search grounding; external route invokes Google Search grounding only and never includes `GEMINI_FILE_SEARCH_STORE` in request assembly.

- [ ] **Step 2: Write RED source-truthfulness tests**

Fake provider responses with no citations/grounding and require `grounded:false`, `sources:[]`, and a degraded/insufficient-evidence message rather than invented sources.

- [ ] **Step 3: Implement internal RAG orchestration**

Before provider call: auth -> privacy -> quota. Map provider File Search source identifiers through `aiKnowledgeSources` manifest so clients receive safe title/reference values, not provider store IDs or Drive authorization data.

- [ ] **Step 4: Implement external grounded query**

Use configured Gemini search-grounding tool. Normalize only provider-returned grounding metadata into `sources`. Maintain academic/informational instruction and reject requests that look like personalized diagnosis/treatment.

- [ ] **Step 5: Implement both API routes**

Use the same bounded error mapping as Task 3. Responses always include explicit `mode`.

- [ ] **Step 6: Run Task 5 tests**

Run: `node --experimental-strip-types --test tests-node/module-c-ai-rag.test.mjs && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add lib/server/ai/rag.ts app/api/ai/rag tests-node/module-c-ai-rag.test.mjs
git commit -m "feat(module-c): add separated internal and external RAG"
```

---

### Task 6: DOCX-to-Structured-Post Draft Pipeline and Composer Integration

**Files:**
- Create: `lib/server/ai/docx.ts`
- Create: `app/api/ai/document-to-post/route.ts`
- Create: `components/portal/docx-post-draft.tsx`
- Modify: `components/portal/social-composer.tsx`
- Test: `tests-node/module-c-ai-docx.test.mjs`
- Test: `tests-node/module-c-ai-docx-ui-contract.test.mjs`

**Interfaces:**
- Consumes: auth/privacy/quota/Gemini adapter/`DocxDraftSchema`.
- Produces: `extractDocxDraft(bytes: Uint8Array, actor: AiActor): Promise<DocxDraft>`.
- UI emits `onDraft(draft: DocxDraft)` to populate composer-local fields only; canonical post creation remains the existing composer/post service path.

- [ ] **Step 1: Write RED DOCX validation tests**

Cover invalid MIME/extension, zero bytes, `> AI_MAX_DOCX_BYTES`, corrupt ZIP/DOCX parser failure, extracted text over `AI_MAX_TEXT_CHARS`, and provider output failing Zod schema.

- [ ] **Step 2: Write RED no-auto-publish UI contract**

Assert `docx-post-draft.tsx` references the document API and `onDraft`, but does not import/call the post creation service directly.

- [ ] **Step 3: Implement DOCX parser service**

Use `mammoth.extractRawText({ buffer })` server-side. Do not store uploaded bytes. Run privacy/de-identification checks on extracted text before Gemini. Gemini returns schema-validated draft fields; uncertain absent values become empty/`uncertainties[]`, not guesses.

- [ ] **Step 4: Implement multipart API route**

Accept one `.docx` field, validate size/MIME before parsing, verify Firebase actor, enforce quota, and return only structured draft JSON.

- [ ] **Step 5: Implement editable composer handoff**

Add a clear “Tạo bản nháp từ DOCX bằng AI” control. The returned title/summary/category/tags/details populate editable local state. User must still press the existing publish/post button.

- [ ] **Step 6: Run Task 6 tests and build the root app**

Run: `node --experimental-strip-types --test tests-node/module-c-ai-docx.test.mjs tests-node/module-c-ai-docx-ui-contract.test.mjs && npm run typecheck && npm run build`

Expected: PASS.

- [ ] **Step 7: Commit Task 6**

```bash
git add lib/server/ai/docx.ts app/api/ai/document-to-post components/portal/docx-post-draft.tsx components/portal/social-composer.tsx tests-node/module-c-ai-docx.test.mjs tests-node/module-c-ai-docx-ui-contract.test.mjs
git commit -m "feat(module-c): add DOCX to post drafting"
```

---

### Task 7: Hardware-Adaptive Engine and Lite Mode

**Files:**
- Create: `lib/hardware-mode.ts`
- Create: `components/providers/hardware-mode-provider.tsx`
- Create: `components/portal/hardware-mode-control.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `components/portal/portal-shell.tsx`
- Test: `tests-node/module-c-hardware-mode.test.mjs`
- Test: `tests-node/module-c-hardware-ui-contract.test.mjs`

**Interfaces:**
- Produces: `deriveHardwareMode(signals: HardwareSignals): 'lite'|'standard'|'enhanced'`.
- Produces: `HardwareModeProvider`, `useHardwareMode()` returning `{ mode, derivedMode, override, setOverride }`.
- Local storage key is stable: `yhct:hardware-mode-override`, values `auto|lite|standard|enhanced`.

- [ ] **Step 1: Write RED pure-classifier tests**

Cases:

```js
assert.equal(deriveHardwareMode({ hardwareConcurrency: 2, deviceMemory: 2, saveData: false, reducedMotion: false }), 'lite');
assert.equal(deriveHardwareMode({ hardwareConcurrency: 8, deviceMemory: 8, saveData: false, reducedMotion: false }), 'enhanced');
assert.equal(deriveHardwareMode({ hardwareConcurrency: undefined, deviceMemory: undefined, saveData: undefined, reducedMotion: false }), 'standard');
assert.equal(deriveHardwareMode({ hardwareConcurrency: 8, deviceMemory: 8, saveData: true, reducedMotion: false }), 'lite');
```

- [ ] **Step 2: Implement pure signal classifier**

Prefer Lite if `saveData` or reduced-motion/low-resource threshold is met; enhanced only when high-resource signals are explicitly available; absent APIs default standard.

- [ ] **Step 3: Implement provider with progressive enhancement**

Read browser APIs inside effects only. Never upload/persist raw values. Manual override survives reload in localStorage. Any thrown browser API access error resolves to standard.

- [ ] **Step 4: Add CSS/data-attribute Lite behavior**

Provider sets `data-hardware-mode` on the document root. `globals.css` uses the attribute to reduce transition/animation/backdrop intensity. Do not hide functional controls/content.

- [ ] **Step 5: Add portal control and mount provider**

Expose Auto/Lite/Standard/Enhanced setting in portal shell; mount provider in `app/layout.tsx` without making layout itself a client component unnecessarily.

- [ ] **Step 6: Run Task 7 tests and root quality gate**

Run: `node --experimental-strip-types --test tests-node/module-c-hardware-mode.test.mjs tests-node/module-c-hardware-ui-contract.test.mjs && npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 7: Commit Task 7**

```bash
git add lib/hardware-mode.ts components/providers/hardware-mode-provider.tsx components/portal/hardware-mode-control.tsx app/layout.tsx app/globals.css components/portal/portal-shell.tsx tests-node/module-c-hardware-mode.test.mjs tests-node/module-c-hardware-ui-contract.test.mjs
git commit -m "feat(module-c): add hardware adaptive Lite Mode"
```

---

### Task 8: Public AI Research UX and ACC AI Control Center

**Files:**
- Create: `components/portal/ai-research-panel.tsx`
- Modify: `components/portal/portal-shell.tsx`
- Create: `admin-portal/lib/ai-ops.ts`
- Create: `admin-portal/app/api/ai/health/route.ts`
- Create: `admin-portal/app/api/ai/analyses/route.ts`
- Create: `admin-portal/app/ai/page.tsx`
- Create: `admin-portal/app/components/ai-control-center.tsx`
- Modify: `admin-portal/app/acc-shell.tsx`
- Test: `tests-node/module-c-ai-public-ui-contract.test.mjs`
- Test: `admin-portal/tests/module-c-ai-control-center.test.mjs`

**Interfaces:**
- Public research UI uses only `/api/ai/rag/internal` or `/api/ai/rag/external`, selected explicitly by user.
- ACC `listAiAnalyses({ limit, cursor, safetySignal?, category? })` hard-caps limit at 50.
- ACC health route returns booleans/config labels only: e.g. `{ configured, fastModel, fileSearchConfigured, driveConfigured }`; never API keys/tokens/store credentials.

- [ ] **Step 1: Write RED public mode-label/source tests**

Assert UI contains explicit Internal CLB / External literature controls and source rendering; it must never merge responses from both routes into one request.

- [ ] **Step 2: Implement public research panel**

Authenticate with current Firebase user ID token, invoke selected route, show loading/degraded errors locally, render sources, and keep manual portal features available when AI fails.

- [ ] **Step 3: Write RED ACC health/queue boundary tests**

Assert AI nav exists only for moderator roles, health response source cannot serialize `GEMINI_API_KEY`, queue limit max is 50, and ACC routes call server role verification.

- [ ] **Step 4: Implement ACC ops routes/UI**

Add AI nav, secret-free health cards, bounded analyses list, internal knowledge manifest/sync/remove controls, and safe quota summary. Reuse Task 4 role policy.

- [ ] **Step 5: Run root + ACC UI tests**

Run: `npm test -- --test-name-pattern="Module C AI" && cd admin-portal && npm test -- --test-name-pattern="Module C AI" && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit Task 8**

```bash
git add components/portal/ai-research-panel.tsx components/portal/portal-shell.tsx admin-portal/lib/ai-ops.ts admin-portal/app/api/ai admin-portal/app/ai admin-portal/app/components/ai-control-center.tsx admin-portal/app/acc-shell.tsx tests-node/module-c-ai-public-ui-contract.test.mjs admin-portal/tests/module-c-ai-control-center.test.mjs
git commit -m "feat(module-c): add AI research and ACC controls"
```

---

### Task 9: Firestore Rules, Indexes, and Security Contracts

**Files:**
- Modify: `firestore.rules`
- Modify: `firestore.indexes.json`
- Test: `tests-node/module-c-ai-rules-contract.test.mjs`
- Test: `tests-node/module-c-ai-security-boundary.test.mjs`

**Interfaces:**
- Server-owned collections: `aiAnalyses`, `aiKnowledgeSources`, `aiQuotaDaily`, `aiQuotaWindows`, and any safe AI operations aggregate added in earlier tasks.
- Direct client writes to all server-owned AI collections are forbidden.

- [ ] **Step 1: Write RED rules/security contract**

Assert Firestore rules contain explicit AI collection matches with client `write: if false`, and only the minimum client reads required by product UI. Prefer server APIs for analyses/knowledge/quota so direct client reads can also remain false.

Assert repository source contains no `NEXT_PUBLIC_GEMINI`, service-account JSON env pattern, `GCP_SERVICE_ACCOUNT_JSON`, or Firebase token fallback introduced by Module C.

- [ ] **Step 2: Add only required indexes**

For ACC analysis queue, add indexes matching implemented queries, such as `createdAt desc`, and composite filter indexes only when code actually queries category/safety + createdAt. Do not pre-create speculative indexes.

- [ ] **Step 3: Run rules/security tests**

Run: `node --experimental-strip-types --test tests-node/module-c-ai-rules-contract.test.mjs tests-node/module-c-ai-security-boundary.test.mjs`

Expected: PASS.

- [ ] **Step 4: Run existing rules regression suite**

Run: `npm test`

Expected: PASS, including Modules A/B and prior ACC/verification/moderation contracts.

- [ ] **Step 5: Commit Task 9**

```bash
git add firestore.rules firestore.indexes.json tests-node/module-c-ai-rules-contract.test.mjs tests-node/module-c-ai-security-boundary.test.mjs
git commit -m "security(module-c): lock AI server-owned data boundaries"
```

---

### Task 10: Full Regression, CI/Release Readiness, Documentation, and Exact-Head Verification

**Files:**
- Modify only if required: `.github/workflows/ci.yml`
- Modify only if required: `.github/workflows/deploy-beta2-firestore-rules.yml`
- Test: `tests-node/module-c-ai-release-readiness.test.mjs`
- Modify: `README.md`

**Interfaces:**
- Produces a feature branch eligible for PR into `release/v1.0`.
- Does not deploy production Firebase, run migration/import, or modify private migration assets.

- [ ] **Step 1: Write release-readiness contract**

Assert:

```js
assert.doesNotMatch(featureValidationWorkflow, /workload_identity_provider.*beta\/2\.0-module-c-ai/s);
assert.match(productionDeployWorkflow, /main/);
assert.doesNotMatch(productionDeployWorkflow, /FIREBASE_TOKEN|credentials_json|GCP_SERVICE_ACCOUNT_JSON/);
```

Also scan Module C production files for `TODO`, `TBD`, raw `console.log`, browser-exposed Gemini key names, credential JSON material, and private member fixture data.

- [ ] **Step 2: Run complete root gate**

Run:

```bash
npm test && npm run typecheck && npm run lint && npm run build
```

Expected: all PASS.

- [ ] **Step 3: Run complete ACC gate**

Run:

```bash
cd admin-portal && npm test && npm run typecheck && npm run lint && npm run build
```

Expected: all PASS.

- [ ] **Step 4: Compare Module C branch to `release/v1.0`**

Confirm changed files are limited to Module C implementation/config/docs/security contracts. Verify no migration workflow, migration script, private migration package, certificate evidence, or production credential material changed unintentionally.

- [ ] **Step 5: Update README**

Document:

- server-only Gemini variables;
- internal vs external RAG behavior;
- ACC knowledge sync roles;
- DOCX draft behavior;
- Lite Mode controls;
- forbidden sensitive AI data;
- quota/degraded-mode behavior;
- local root/ACC run commands;
- feature/release validation versus main-only production deployment boundary.

- [ ] **Step 6: Commit final readiness state**

```bash
git add README.md tests-node/module-c-ai-release-readiness.test.mjs .github/workflows
git commit -m "docs(module-c): document AI engine operations"
```

- [ ] **Step 7: Verify exact final feature SHA in GitHub Actions**

Required checks on the exact head SHA:

- public test/typecheck/lint/build: success;
- ACC test/typecheck/lint/build: success;
- Firebase policy validation: success if triggered for this branch;
- production Firebase deploy: not authenticated/not run from Module C feature branch.

- [ ] **Step 8: Final self-review against spec acceptance criteria**

Verify all 10 acceptance criteria in the spec with concrete source/tests/CI evidence. Do not mark Module C complete if internal RAG, external RAG, DOCX drafting, hardware adaptive mode, or sensitive-data boundary is stubbed, disabled without an explicit degraded path, or represented only by UI.

- [ ] **Step 9: Integrate through PR to `release/v1.0`**

Create a PR from `beta/2.0-module-c-ai` to `release/v1.0`, include exact feature SHA and CI run IDs, and merge only when mergeable + required checks are green. Then verify the exact release merge SHA with post-merge CI/policy validation.

Production `main` must remain unchanged at this stage.
