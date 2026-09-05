import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const path = 'lib/server/member-auth.ts';

test('Module D root member auth is server-only and enforces club membership/password rotation', () => {
  assert.equal(fs.existsSync(path), true, `${path} must exist`);
  const source = fs.readFileSync(path, 'utf8');
  assert.match(source, /rootAdminAuth/);
  assert.match(source, /verifyIdToken\(/);
  assert.match(source, /clubMember/);
  assert.match(source, /mustChangePassword/);
  assert.match(source, /moderator/);
  assert.match(source, /CLUB_AUTH_REQUIRED/);
  assert.match(source, /CLUB_MEMBERSHIP_REQUIRED/);
  assert.match(source, /PASSWORD_ROTATION_REQUIRED/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_/);
  assert.doesNotMatch(source, /FIREBASE_TOKEN|credentials_json|GCP_SERVICE_ACCOUNT_JSON|serviceAccountKey/);
});
