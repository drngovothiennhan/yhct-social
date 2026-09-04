import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../scripts/setup-acc-wif.sh', import.meta.url), 'utf8');

test('ACC runtime WIF is dedicated, keyless, and production-project constrained', () => {
  assert.match(source, /yhct-acc-runtime/);
  assert.match(source, /roles\/firebaseauth\.admin/);
  assert.match(source, /roles\/datastore\.user/);
  assert.match(source, /https:\/\/oidc\.vercel\.com\/hiu-yhct/);
  assert.match(source, /owner:hiu-yhct:project:yhct-social-admin:environment:production/);
  assert.match(source, /roles\/iam\.workloadIdentityUser/);
  assert.doesNotMatch(source, /keys create|service-account-key|private_key/i);
});
