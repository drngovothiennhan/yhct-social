import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const productionFirebase = await readFile(new URL('../.github/workflows/deploy-firebase-rules.yml', import.meta.url), 'utf8');
const betaValidation = await readFile(new URL('../.github/workflows/deploy-beta2-firestore-rules.yml', import.meta.url), 'utf8');
const migration = await readFile(new URL('../.github/workflows/migrate-firestore.yml', import.meta.url), 'utf8');

test('production Firebase deploy remains main-only and WIF-only', () => {
  assert.match(productionFirebase, /branches:\s*\[main\]/);
  assert.match(productionFirebase, /github-yhct-social\/providers\/github-main/);
  assert.match(productionFirebase, /google-github-actions\/auth@v3/);
  assert.doesNotMatch(productionFirebase, /credentials_json|GCP_SERVICE_ACCOUNT_JSON|FIREBASE_TOKEN/);
});

test('release validation never crosses the production OIDC trust boundary', () => {
  assert.match(betaValidation, /branches:\s*\[release\/v1\.0\]/);
  assert.doesNotMatch(betaValidation, /id-token:\s*write/);
  assert.doesNotMatch(betaValidation, /google-github-actions\/auth/);
  assert.doesNotMatch(betaValidation, /workload_identity_provider/);
});

test('migration remains separately gated and does not run from Module C feature branch', () => {
  assert.doesNotMatch(migration, /beta\/2\.0-module-c/);
  assert.match(migration, /github-main|main/);
});
