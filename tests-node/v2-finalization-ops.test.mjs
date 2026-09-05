import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('v2 finalization workflow provisions recovery through existing keyless WIF only', () => {
  const workflow = read('.github/workflows/finalize-v2-production.yml');
  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /projects\/244889451934\/locations\/global\/workloadIdentityPools\/github-yhct-social\/providers\/github-main/);
  assert.match(workflow, /yhct-github-deploy@yhct-social-260902-42a4\.iam\.gserviceaccount\.com/);
  assert.match(workflow, /yhct-social-260902-42a4/);
  assert.match(workflow, /firestore databases describe/);
  assert.match(workflow, /yhct-social-recovery-prod-244889451934/);
  assert.match(workflow, /versioning/);
  assert.match(workflow, /lifecycle/);
  assert.doesNotMatch(workflow, /service[_-]?account.*json|private[_-]?key|FIREBASE_TOKEN|refresh[_-]?token/i);
});

test('finalization validates permissions at each resource boundary instead of one mixed project probe', () => {
  const workflow = read('.github/workflows/finalize-v2-production.yml');
  assert.doesNotMatch(workflow, /projects\/\$\{GOOGLE_CLOUD_PROJECT\}:testIamPermissions/);
  assert.match(workflow, /firestore databases describe/);
  assert.match(workflow, /projects add-iam-policy-binding/);
  assert.match(workflow, /storage buckets (?:describe|create)/);
  assert.match(workflow, /finalize-v2-e2e\.mjs/);
  assert.match(workflow, /firestore export/);
  assert.match(workflow, /firestore import/);
});

test('v2 finalization performs synthetic credentialed E2E without logging passwords', () => {
  const workflow = read('.github/workflows/finalize-v2-production.yml');
  const e2e = read('scripts/finalize-v2-e2e.mjs');
  assert.match(workflow, /finalize-v2-e2e\.mjs/);
  assert.match(e2e, /E2E_MEMBER_001/);
  assert.match(e2e, /E2E_MOD_001/);
  assert.match(e2e, /E2E_ADMIN_001/);
  assert.match(e2e, /member/);
  assert.match(e2e, /mod/);
  assert.match(e2e, /admin/);
  assert.match(e2e, /signInWithPassword/);
  assert.match(e2e, /mustChangePassword:\s*false/);
  assert.doesNotMatch(e2e, /console\.(?:log|info|warn|error)\([^\n]*(?:password|credential)/i);
});

test('v2 finalization keeps recovery isolated and never automates production cutover', () => {
  const workflow = read('.github/workflows/finalize-v2-production.yml');
  assert.match(workflow, /recovery-v2-final-/);
  assert.match(workflow, /firestore export/);
  assert.match(workflow, /firestore import/);
  assert.match(workflow, /firestore databases delete/);
  assert.match(workflow, /\(default\)/);
  assert.doesNotMatch(workflow, /database.*update.*\(default\)|cutover.*production|promote.*recovery/i);
});

test('finalization persists recovery configuration in Vercel before ACC production redeploy', () => {
  const workflow = read('.github/workflows/finalize-v2-production.yml');
  const deploy = read('.github/workflows/deploy-admin-portal.yml');
  assert.match(workflow, /RECOVERY_GCP_PROJECT_ID/);
  assert.match(workflow, /RECOVERY_GCP_LOCATION/);
  assert.match(workflow, /RECOVERY_EXPORT_BUCKET/);
  assert.match(workflow, /api\.vercel\.com\/v10\/projects/);
  assert.match(workflow, /upsert=true/);
  assert.match(workflow, /vercel deploy --cwd admin-portal --prod/);
  assert.doesNotMatch(deploy, /google-github-actions\/auth|service_account\s*:/i);
});

test('legacy member provisioning verification no longer requires first-login rotation', () => {
  const workflow = read('.github/workflows/provision-beta2-members.yml');
  assert.doesNotMatch(workflow, /claims\.mustChangePassword\s*!==\s*true/);
});
