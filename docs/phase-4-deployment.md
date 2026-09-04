# Giai đoạn 4 — Production Deployment

## Production targets

- GitHub repository: `drngovothiennhan/yhct-social`
- Firebase project: `yhct-social-260902-42a4`
- Frontend hosting: Vercel
- Runtime database: Cloud Firestore
- Authentication: Firebase Auth
- Media: Firebase Storage

## Firebase console requirements

Enable these products in `yhct-social-260902-42a4`:

1. Authentication -> Sign-in method -> Google.
2. Authentication -> Sign-in method -> Email/Password.
3. Cloud Firestore -> Native mode database.
4. Storage -> default Firebase Storage bucket.
5. Add the final Vercel production domain to Authentication -> Settings -> Authorized domains.

## Firebase Web App variables

Create one Firebase Web App and copy its config values into Vercel for Production, Preview and Development:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

These are Firebase web configuration identifiers, not service-account private keys.

## GitHub OIDC Firebase rules deployment

The repository workflow `.github/workflows/deploy-firebase-rules.yml` reuses repository variables:

- `GCP_WIF_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`

The referenced service account must have the minimum Google Cloud/Firebase roles necessary to deploy Firestore rules/indexes and Storage rules.

## Vercel

Import `drngovothiennhan/yhct-social`, use framework preset Next.js, root directory `/`, build command `npm run build`, and Node.js 22.x. Add all six Firebase web variables to Production, Preview and Development before the first successful build.

## Production smoke test

After deployment:

1. Load `/` without console errors.
2. Register a new member with Email/Password.
3. Sign out and sign in with Google.
4. Create one `qa` post and verify realtime appearance.
5. Like/unlike the post.
6. Add a root comment and one nested reply.
7. Upload an image post and confirm Storage access.
8. Confirm an unverified practitioner cannot set `professionalLabel=true`.
9. Confirm a clinical case cannot be submitted without `isDeidentified=true`.
10. Confirm a normal member cannot modify `role` or `verificationStatus=verified`.
