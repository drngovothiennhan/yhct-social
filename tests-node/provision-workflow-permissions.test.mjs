import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../.github/workflows/provision-beta2-members.yml', import.meta.url), 'utf8');

test('provisioning workflow probes Firestore and Firebase Auth permissions before writes', () => {
  assert.match(source, /Diagnose Firebase API permissions/);
  assert.match(source, /firestore\.googleapis\.com/);
  assert.match(source, /identitytoolkit\.googleapis\.com/);
  assert.match(source, /FIRESTORE_PERMISSION_PROBE=PASS/);
  assert.match(source, /FIREBASE_AUTH_PERMISSION_PROBE=PASS/);
});
