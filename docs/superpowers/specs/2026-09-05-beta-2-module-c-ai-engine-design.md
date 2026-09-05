# Beta 2.0 Module C — AI Engine Design

Date: 2026-09-05
Status: Approved design, awaiting written-spec review
Base branch: `release/v1.0`
Feature branch: `beta/2.0-module-c-ai`

## 1. Purpose

Module C adds the AI capabilities defined by the Beta 2.0 program while preserving the security, isolation, and production trust boundaries established in Modules A/B and ACC hardening.

Module C is complete only when all five product capabilities are implemented and verified:

1. Gemini moderation and post classification.
2. Internal-club RAG over admin/mod-approved YHCT documents.
3. External literature RAG with source-aware synthesis.
4. DOCX-to-structured-post drafting.
5. Hardware-adaptive client mode with Lite Mode fallback.

Module C must not deploy production Firebase from its feature or release branch, widen the main-only production WIF trust boundary, expose a Gemini API key to the browser, or send identifiable private member/patient data to free-tier AI services.

## 2. Existing-system constraints

The repository already uses a newer Next.js App Router stack than the original Next.js 14 baseline. Module C will use the repository's current compatible Next.js/TypeScript runtime and will not downgrade the framework merely to match the earlier baseline version number.

Existing Firebase Auth, custom claims, Firestore rules, ACC authorization, Vercel OIDC/WIF, audit design, and production deployment boundaries remain authoritative.

The existing independent ACC remains the administrative control plane. AI administrative tools are added to ACC rather than coupled to the public newsfeed bundle.

## 3. Architecture overview

Module C is divided into seven bounded units:

- C1: Gemini server gateway.
- C2: AI moderation and classification.
- C3: Dual RAG — internal and external.
- C4: DOCX-to-post structured extraction.
- C5: Hardware-adaptive/Lite Mode engine.
- C6: AI privacy, safety, and data-boundary controls.
- C7: Free-tier quota, caching, resilience, and observability.

Public clients never call Gemini directly. All AI calls execute in server-side Next.js route handlers or ACC server routes. Browser code receives only validated application results.

## 4. C1 — Gemini server gateway

### 4.1 Dependencies and configuration

Use the current Google Gemini JavaScript SDK (`@google/genai`) behind a server-only adapter. Add schema validation with `zod`. DOCX text extraction uses a maintained server-side DOCX parser such as `mammoth`; the implementation plan may replace this only if tests demonstrate a materially safer or smaller dependency.

Required server environment variables:

- `GEMINI_API_KEY`
- `GEMINI_MODEL_FAST`
- `GEMINI_MODEL_REASONING` when a second model is used
- `GEMINI_FILE_SEARCH_STORE` or equivalent File Search store identifier after provisioning
- configurable AI request/token limits

Forbidden configuration:

- `NEXT_PUBLIC_GEMINI_API_KEY`
- Gemini keys committed to source control
- service-account JSON credentials
- Firebase token fallback for Google cloud authentication

### 4.2 Gateway API

Create a focused server-only AI library with typed functions rather than scattering SDK calls across route handlers.

Initial route surfaces:

- `POST /api/ai/analyze-post`
- `POST /api/ai/document-to-post`
- `POST /api/ai/rag/internal`
- `POST /api/ai/rag/external`

ACC-only synchronization/knowledge routes live under the independent ACC application.

Every route must enforce:

- authenticated Firebase identity where required;
- role checks for ACC-only operations;
- `mustChangePassword != true` for mutable/privileged actions;
- strict body-size and MIME limits;
- schema validation;
- timeout/abort handling;
- normalized error responses that never include secrets or raw provider traces;
- request throttling and quota guard checks before provider invocation.

## 5. C2 — AI moderation and classification

### 5.1 Scope

AI may assist with:

- detecting harassment, inflammatory language, spam, and unsafe/disallowed content signals;
- classifying content into the supported YHCT categories such as `clinical`, `theory`, `herbal`, `club`, or `other`;
- generating a short rationale and confidence score for moderator review.

### 5.2 Human-authority boundary

AI output is advisory. It must not directly:

- delete or hide a post;
- suspend/disable a user;
- change a user's role;
- approve practitioner verification;
- issue irreversible disciplinary actions.

Existing ACC moderation transactions remain the only mutation path for moderation actions. AI signals may be displayed in ACC and may pre-fill a recommended classification, but a human moderator retains authority.

### 5.3 Persistence

AI analysis should be stored separately from the canonical social post record so provider/model changes do not mutate social-source truth.

Use an `aiAnalyses/{analysisId}`-style record containing at minimum:

- target type/id;
- content hash;
- model/config version;
- category prediction;
- safety signals;
- confidence;
- sanitized rationale;
- created timestamp;
- creator type (`system` or authenticated requester);
- expiry/recompute metadata where appropriate.

Analysis IDs should be deterministic from target + content hash + analysis kind so unchanged content can reuse prior results safely.

## 6. C3 — Dual RAG system

Internal and external RAG are separate execution modes and separate route contracts. They are not silently mixed in one answer.

### 6.1 Internal CLB RAG

Purpose: answer questions from YHCT books, documents, and internal academic material explicitly approved by Admin/Mod.

Source pipeline:

1. ACC Admin/Mod selects or authorizes an approved Google Drive folder/source set.
2. Server-side sync reads only files shared/authorized for the runtime identity.
3. Supported academic documents are extracted/normalized.
4. Files are uploaded/indexed into Gemini File Search or the current equivalent managed Gemini retrieval store.
5. A manifest in Firestore tracks source identity, content/version hash, provider document ID, sync status, and timestamps.
6. Changed files are re-indexed; removed/revoked files are removed from the retrieval store.

The Google Drive runtime must use server-side Google credentials. Prefer the existing Vercel OIDC/WIF pattern and least-privilege Drive access. Do not introduce downloadable service-account JSON.

Internal RAG answers must return application-level source references from the indexed manifest. If no relevant internal evidence is found, the system must state that rather than fabricate a source.

### 6.2 External literature RAG

Purpose: synthesize broader external information using Gemini search/grounding capabilities when configured and available.

Requirements:

- external mode is explicitly selected/labeled;
- results expose source/grounding references returned by the provider;
- no internal-only document contents are appended to external-search requests unless a future design explicitly approves that combination;
- medically sensitive claims are framed as academic/informational, not as diagnosis or personalized treatment;
- provider failure or no-grounding result returns a clear degraded response instead of invented citations.

### 6.3 RAG access control

Internal knowledge administration is ACC-only and limited to `mod`, `super_mod`, or `admin` according to sync-management policy; destructive source-store actions require `super_mod`/`admin`.

Public/member query access may be enabled only through the bounded server RAG route and never exposes provider store IDs, raw Drive tokens, or private file paths.

## 7. C4 — DOCX-to-Post

### 7.1 User flow

`DOCX upload -> file validation -> local/server text extraction -> privacy screening -> Gemini structured extraction -> Zod validation -> editable preview -> user confirms -> existing post creation flow`

AI never publishes automatically.

### 7.2 File controls

Initially accept `.docx` only.

Enforce:

- DOCX MIME/extension validation;
- a conservative configurable file-size limit;
- parser timeout/maximum extracted-text size;
- rejection of unsupported/encrypted/corrupt files;
- no persistent public URL for uploaded source documents unless a later approved requirement needs retention.

Temporary files/bytes must be discarded after processing unless the user explicitly saves the resulting post draft.

### 7.3 Structured output schema

The AI result is a draft object with fields such as:

- `title`
- `summary`
- `category`
- `batCuong`
- `tangPhu`
- `diagnosticPattern`
- `herbs[]` containing name, amount, unit, note
- `usage`
- `tags[]`
- `uncertainties[]`

All structured output is schema-validated. Unsupported or uncertain fields remain empty and are surfaced as uncertainty rather than guessed.

The user reviews and edits before the existing post service is invoked.

## 8. C5 — Hardware-Adaptive Engine

### 8.1 Goal

Adapt visual cost on weaker devices without using invasive fingerprinting or transmitting hardware characteristics to the server.

### 8.2 Inputs

Use progressive enhancement around supported browser signals:

- `navigator.hardwareConcurrency`
- `navigator.deviceMemory` when available
- Network Information API values when available
- `saveData`
- `prefers-reduced-motion`

Missing APIs must not cause errors.

### 8.3 Modes

The engine derives one of:

- `lite`
- `standard`
- `enhanced`

Users can manually override the derived mode. Manual override is stored locally in the browser; raw hardware values are not persisted to Firestore for this feature.

### 8.4 Lite Mode behavior

Lite Mode should favor usability over visual effects by:

- disabling/reducing nonessential animation and heavy blur/backdrop effects;
- reducing image quality/preload aggressiveness;
- avoiding autoplay;
- reducing feed/media prefetch volume;
- avoiding expensive decorative effects;
- retaining all core navigation, posting, reading, moderation, and accessibility flows.

A failure in the adaptive engine must default to `standard`, never block rendering.

## 9. C6 — Privacy, safety, and AI data boundaries

### 9.1 Forbidden AI payloads

The application must not send the following to free-tier Gemini processing:

- MSSV/member provisioning credentials;
- email addresses or account credentials;
- CCCD/government identity data;
- practitioner certificate evidence;
- private ACC/audit data;
- identifiable patient data;
- other private member information not required for the requested AI function.

Clinical case content is eligible only after de-identification validation.

### 9.2 Prompt-injection and source safety

RAG document contents are untrusted data, not system instructions.

The gateway must:

- maintain fixed server-side system instructions;
- treat retrieved text as evidence only;
- never allow document content to request secrets, change RBAC, or invoke administrative mutations;
- never expose environment variables, tokens, internal prompts, provider store identifiers, or server file paths;
- cap source/context size.

### 9.3 Medical-content posture

The AI feature is an academic assistant for YHCT discussion and document organization. It does not replace professional medical diagnosis. Personalized diagnosis/treatment flows are outside Module C.

## 10. C7 — Free-tier guard, resilience, and observability

### 10.1 Cost/quota controls

Provide configurable guards for:

- per-user request frequency;
- daily global request ceiling;
- maximum input/output size;
- model selection by environment;
- deterministic cache reuse using sanitized content hash;
- internal RAG sync deduplication using source/version hash.

The system must not assume one model name or one free-tier quota forever.

### 10.2 Failure behavior

AI is non-critical infrastructure for the public portal. If Gemini or Drive/RAG is unavailable:

- public feed and authentication continue operating;
- normal manual posting continues operating;
- ACC core moderation/member management continues operating;
- AI widgets show a bounded unavailable/degraded state;
- failures do not leak raw provider responses.

### 10.3 Observability

Record safe operational metrics such as:

- operation type;
- success/failure class;
- duration bucket;
- cache hit/miss;
- model/config version;
- quota-rejection state.

Do not log raw private prompt bodies or document contents by default.

## 11. Firestore and Storage policy

Any new AI collections are server-owned unless a specific client read contract is required.

Expected policy:

- clients cannot write `aiAnalyses`, RAG manifests, quota counters, or AI operational records directly;
- ACC privileged mutations use server routes plus authenticated role verification;
- source documents used only for transient DOCX conversion are not made public;
- existing certificate and migration/private-data protections remain unchanged.

Indexes are added only for bounded application queries used by UI/operations.

## 12. ACC additions

ACC receives an `AI` section with bounded screens for:

- AI health/config status without exposing secrets;
- moderation-analysis queue/filtering;
- internal knowledge source manifest and sync status;
- source resync/remove actions with role checks;
- quota/usage summary using safe aggregate data.

ACC AI routes re-verify Firebase ID token, role, and password-change gate server-side. UI-only role hiding is insufficient.

## 13. Public/member additions

Public/member surfaces include only the approved capabilities:

- optional AI-assisted post categorization/advice;
- DOCX-to-post draft tool for authenticated eligible users;
- internal/external academic query modes where enabled;
- adaptive visual mode controls.

Every AI-generated field or answer is visibly identified as AI-assisted and remains editable/reviewable where it affects user-authored content.

## 14. Testing strategy

Implementation follows TDD.

Required contract/unit coverage includes:

- Gemini key is server-only and no `NEXT_PUBLIC_GEMINI*` variable exists;
- AI routes validate authentication, role, input size, schema, and rate/quota guard;
- moderation analysis cannot directly invoke moderation mutations;
- deterministic content-hash caching behavior;
- RAG internal/external route separation;
- RAG source manifest synchronization and idempotency;
- forbidden sensitive fields are rejected/redacted before provider calls;
- prompt-injection documents cannot override system/security boundaries;
- DOCX invalid/corrupt/oversize handling;
- structured extraction schema and uncertainty behavior;
- DOCX processing never auto-publishes;
- hardware detection falls back safely when APIs are absent;
- Lite Mode manual override persistence;
- AI provider failure does not break public feed/ACC core routes;
- Firestore/Storage client rules deny server-owned AI writes;
- production deploy workflow remains main-only OIDC/WIF and contains no JSON/token fallback.

Full gates before release integration:

Root application:

`npm test && npm run typecheck && npm run lint && npm run build`

ACC:

`cd admin-portal && npm test && npm run typecheck && npm run lint && npm run build`

Exact feature-head GitHub Actions must be green before PR integration.

## 15. Release and production boundary

Module C development occurs only on `beta/2.0-module-c-ai` (or child hotfix branches if needed), based on `release/v1.0`.

The feature branch may run CI and policy validation but must not authenticate to/deploy Firebase production.

Integration target is `release/v1.0` after all Module C gates pass.

Production `main` remains unchanged until a later explicit production-promotion decision. The production Workload Identity Federation trust condition remains scoped to `main`.

Module C does not trigger Firestore migration/reimport merely because AI collections are added.

## 16. Out of scope

The following are not Module C:

- Backup/restore, Safe Mode, runtime recovery: Module D.
- New club points/attendance ledger.
- Payment or subscription billing.
- Autonomous account suspension or autonomous destructive moderation.
- Personalized medical diagnosis/treatment.
- Training/fine-tuning a custom foundation model.
- Replacing Firebase Auth/RBAC.

## 17. Acceptance criteria

Module C is complete only when all of the following are true:

1. Server-only Gemini gateway is implemented with no browser API-key exposure.
2. AI moderation/classification produces advisory, validated, cacheable analysis without autonomous punitive actions.
3. Internal RAG can synchronize approved academic sources and answer with source references.
4. External RAG is separately selectable and returns grounded/source-aware output or a truthful degraded result.
5. DOCX conversion extracts a schema-valid editable draft and never auto-publishes.
6. Hardware-adaptive engine reliably derives `lite | standard | enhanced`, supports user override, and never blocks rendering.
7. Sensitive-data boundary tests prevent private/identifiable inputs from reaching free-tier Gemini paths.
8. Provider/quota failure cannot take down the newsfeed, manual posting, authentication, or ACC core administration.
9. Root and ACC test/typecheck/lint/build gates pass on the exact final feature SHA.
10. Release integration validation passes and production `main`/main-only WIF remain untouched.

Only after these criteria pass may the project proceed to Module D: Backup, Error Boundary, Safe Mode, and Restore/Rollback.
