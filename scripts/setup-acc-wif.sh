#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ID='yhct-social-260902-42a4'
SA_ID='yhct-acc-runtime'
SA_EMAIL="${SA_ID}@${PROJECT_ID}.iam.gserviceaccount.com"
POOL_ID='vercel-yhct-social'
PROVIDER_ID='vercel-acc'
VERCEL_ISSUER='https://oidc.vercel.com/hiu-yhct'
VERCEL_SUBJECT='owner:hiu-yhct:project:yhct-social-admin:environment:production'

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
test -n "$PROJECT_NUMBER"

gcloud config set project "$PROJECT_ID" >/dev/null

gcloud services enable \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  identitytoolkit.googleapis.com \
  firestore.googleapis.com \
  --project "$PROJECT_ID" \
  --quiet

if ! gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_ID" \
    --project "$PROJECT_ID" \
    --display-name='YHCT ACC runtime' \
    --description='Keyless runtime identity for the isolated YHCT Admin Control Center'
fi

for role in roles/firebaseauth.admin roles/datastore.user roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$role" \
    --condition=None \
    --quiet >/dev/null
done

if ! gcloud iam workload-identity-pools describe "$POOL_ID" \
  --location=global \
  --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL_ID" \
    --location=global \
    --project "$PROJECT_ID" \
    --display-name='Vercel YHCT Social'
fi

if gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --workload-identity-pool="$POOL_ID" \
  --location=global \
  --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers update-oidc "$PROVIDER_ID" \
    --workload-identity-pool="$POOL_ID" \
    --location=global \
    --project "$PROJECT_ID" \
    --issuer-uri="$VERCEL_ISSUER" \
    --attribute-mapping='google.subject=assertion.sub' \
    --attribute-condition="assertion.sub == '${VERCEL_SUBJECT}'"
else
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
    --workload-identity-pool="$POOL_ID" \
    --location=global \
    --project "$PROJECT_ID" \
    --display-name='Vercel ACC production' \
    --issuer-uri="$VERCEL_ISSUER" \
    --attribute-mapping='google.subject=assertion.sub' \
    --attribute-condition="assertion.sub == '${VERCEL_SUBJECT}'"
fi

PRINCIPAL="principal://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/subject/${VERCEL_SUBJECT}"

gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project "$PROJECT_ID" \
  --member="$PRINCIPAL" \
  --role='roles/iam.workloadIdentityUser' \
  --quiet >/dev/null

echo "ACC_WIF_SETUP=PASS project=${PROJECT_ID} service_account=${SA_EMAIL} pool=${POOL_ID} provider=${PROVIDER_ID}"
