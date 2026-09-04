#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT="yhct-social-260902-42a4"
REGION="asia-southeast1"
INSTANCE="yhct-postgres"
DATABASE="yhct_vnext"
SERVICE="yhct-social-vnext"
EXPECTED_REPO="drngovothiennhan/yhct-social"
EXPECTED_REF="main"
EXPECTED_SERVICE_ACCOUNT="${GCP_DEPLOY_SERVICE_ACCOUNT:-}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
ARTIFACT_DIR="$ROOT/.artifacts"
DIFF_FILE="$ARTIFACT_DIR/sql_connect_core.diff.txt"
FIREBASE_PROJECTS_JSON="$ARTIFACT_DIR/firebase-projects.json"

fail() {
  printf 'SQL_CONNECT_GITHUB_DEPLOY=BLOCKED reason=%s\n' "$1" >&2
  exit 1
}

for cmd in gcloud firebase python3 grep; do
  command -v "$cmd" >/dev/null 2>&1 || fail "TOOL_MISSING:$cmd"
done

[[ "${GITHUB_ACTIONS:-}" == "true" ]] || fail "NOT_GITHUB_ACTIONS"
[[ "${GITHUB_REPOSITORY:-}" == "$EXPECTED_REPO" ]] || fail "REPOSITORY_MISMATCH"
[[ "${GITHUB_REF_NAME:-}" == "$EXPECTED_REF" ]] || fail "REF_NOT_MAIN"
[[ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]] || fail "ADC_CREDENTIAL_FILE_MISSING"
[[ -f "$GOOGLE_APPLICATION_CREDENTIALS" ]] || fail "ADC_CREDENTIAL_FILE_NOT_FOUND"
[[ -n "$EXPECTED_SERVICE_ACCOUNT" ]] || fail "DEPLOY_SERVICE_ACCOUNT_MISSING"

echo "GITHUB_CONTEXT_GATE=PASS repo=$GITHUB_REPOSITORY ref=$GITHUB_REF_NAME"

cd "$ROOT"
mkdir -p "$ARTIFACT_DIR"

gcloud auth application-default print-access-token >/dev/null 2>&1 \
  || fail "ADC_TOKEN_EXCHANGE_FAILED"
echo "OIDC_ADC_GATE=PASS"

gcloud config set project "$PROJECT" --quiet >/dev/null

gcloud projects describe "$PROJECT" --format='value(projectId)' >/dev/null 2>&1 \
  || fail "PROJECT_ACCESS_DENIED"
echo "PROJECT_GATE=PASS project=$PROJECT"

ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -n 1 || true)"
if [[ -n "$ACTIVE_ACCOUNT" && "$ACTIVE_ACCOUNT" != "$EXPECTED_SERVICE_ACCOUNT" ]]; then
  fail "SERVICE_ACCOUNT_MISMATCH"
fi
echo "IDENTITY_GATE=PASS service_account=$EXPECTED_SERVICE_ACCOUNT"

INSTANCE_INFO="$(gcloud sql instances describe "$INSTANCE" \
  --project="$PROJECT" \
  --format='value(region,state)' 2>/dev/null)" \
  || fail "INSTANCE_NOT_FOUND"
read -r INSTANCE_REGION INSTANCE_STATE <<<"$INSTANCE_INFO"
[[ "$INSTANCE_REGION" == "$REGION" ]] || fail "INSTANCE_REGION_MISMATCH"
[[ "$INSTANCE_STATE" == "RUNNABLE" ]] || fail "INSTANCE_NOT_RUNNABLE"
echo "INSTANCE_GATE=PASS instance=$INSTANCE region=$INSTANCE_REGION state=$INSTANCE_STATE"

if gcloud sql databases describe "$DATABASE" \
  --instance="$INSTANCE" \
  --project="$PROJECT" \
  --format='value(name)' >/dev/null 2>&1; then
  echo "VNEXT_DATABASE_GATE=PASS mode=reuse database=$DATABASE"
else
  gcloud sql databases create "$DATABASE" \
    --instance="$INSTANCE" \
    --project="$PROJECT" \
    --quiet >/dev/null \
    || fail "VNEXT_DATABASE_CREATE_FAILED"
  echo "VNEXT_DATABASE_GATE=PASS mode=create database=$DATABASE"
fi

firebase projects:list --json --non-interactive >"$FIREBASE_PROJECTS_JSON" 2>/dev/null \
  || fail "FIREBASE_PROJECT_LIST_FAILED"

if ! python3 - "$FIREBASE_PROJECTS_JSON" "$PROJECT" <<'PY'
import json
import sys

path, project = sys.argv[1:3]
with open(path, encoding="utf-8") as fh:
    data = json.load(fh)
items = data.get("result") or []
if not any(item.get("projectId") == project for item in items):
    raise SystemExit(1)
PY
then
  fail "FIREBASE_PROJECT_ACCESS_DENIED"
fi
echo "FIREBASE_GATE=PASS project=$PROJECT"

firebase dataconnect:sql:diff "$SERVICE" \
  --project "$PROJECT" \
  --non-interactive >"$DIFF_FILE" \
  || fail "SQL_CONNECT_DIFF_FAILED"
echo "SQL_CONNECT_DIFF_GATE=PASS file=$DIFF_FILE"

if grep -Eiq 'DROP[[:space:]]+(TABLE|SCHEMA|COLUMN|TYPE|DATABASE)' "$DIFF_FILE"; then
  fail "DESTRUCTIVE_SQL_DIFF"
fi
if grep -Eiq 'TRUNCATE[[:space:]]+' "$DIFF_FILE"; then
  fail "DESTRUCTIVE_SQL_DIFF"
fi

grep -F 'schemaValidation: COMPATIBLE' "$ROOT/dataconnect/dataconnect.yaml" >/dev/null \
  || fail "SCHEMA_VALIDATION_NOT_COMPATIBLE"

firebase dataconnect:sql:migrate "$SERVICE" \
  --project "$PROJECT" \
  --non-interactive \
  || fail "SQL_CONNECT_MIGRATION_FAILED"
echo "SQL_CONNECT_MIGRATION_GATE=PASS"

firebase dataconnect:sdk:generate \
  --project "$PROJECT" \
  --non-interactive \
  || fail "SQL_CONNECT_SDK_GENERATE_FAILED"
echo "SQL_CONNECT_SDK_GATE=PASS"

firebase deploy --only "dataconnect:$SERVICE" \
  --project "$PROJECT" \
  --non-interactive \
  || fail "SQL_CONNECT_SERVICE_DEPLOY_FAILED"
echo "SQL_CONNECT_SERVICE_GATE=PASS service=$SERVICE"

firebase dataconnect:services:list \
  --project "$PROJECT" \
  --non-interactive \
  | grep -F "$SERVICE" >/dev/null \
  || fail "SERVICE_READBACK_MISSING"

echo "SQL_CONNECT_READBACK_GATE=PASS service=$SERVICE"
echo "SQL_CONNECT_GITHUB_DEPLOY=PASS"
