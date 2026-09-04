# Production Readiness — YHCT Social

Verified on 2026-09-04.

## Code status

- Repository: `drngovothiennhan/yhct-social`
- Firebase project target: `yhct-social-260902-42a4`
- Application CI: tests, TypeScript, ESLint and Next.js production build have passed on GitHub Actions.
- Domain/security test suite: 13 tests.

## Deployment gates still requiring account credentials

### Firebase

The deployment workflow accepts one of these authentication modes, in priority order:

1. Repository variables `GCP_WIF_PROVIDER` and `GCP_DEPLOY_SERVICE_ACCOUNT` (recommended, keyless OIDC).
2. Repository secret `GCP_SERVICE_ACCOUNT_JSON`.
3. Repository secret `FIREBASE_TOKEN` (legacy fallback only).

At verification time none of the three modes was configured, so the workflow correctly stopped before changing Firestore or Storage production rules.

### Vercel

The production workflow requires these GitHub Actions secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

At verification time all nine were absent, so the workflow correctly stopped before deployment.

## Go-live definition

Production is considered live only after all conditions are true:

1. CI is green.
2. Firebase rules/indexes/storage deployment succeeds against `yhct-social-260902-42a4`.
3. Vercel production deployment succeeds and returns HTTP 2xx/3xx.
4. Firebase Authentication authorized domains include the final Vercel/custom domain.
5. Smoke tests pass for Email/Password auth, Google auth, onboarding, realtime posts, media upload, like/unlike, nested comments, clinical-case de-identification, and verified-practitioner professional labels.
