import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as accessPolicy from '../lib/access-policy.ts';

const shell = readFileSync(new URL('../app/acc-shell.tsx', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../app/dashboard.tsx', import.meta.url), 'utf8');
const authGate = readFileSync(new URL('../app/auth-gate.tsx', import.meta.url), 'utf8');
const route = readFileSync(new URL('../app/api/session/change-password/route.ts', import.meta.url), 'utf8');
const rotateStart = authGate.indexOf('async function rotatePassword');
const rotateEnd = authGate.indexOf('if (!user) return', rotateStart);
const rotateBlock = authGate.slice(rotateStart, rotateEnd);

test('ACC exposes a normal authenticated password-change destination', () => {
  assert.match(shell, /\['\/security',\s*'Đổi mật khẩu'\]/);
  assert.match(dashboard, /export function SecurityPanel/);
  assert.match(dashboard, /Mật khẩu hiện tại/);
  assert.match(dashboard, /Xác nhận mật khẩu mới/);
});

test('normal password change reauthenticates the Firebase user before calling the server', () => {
  assert.match(dashboard, /reauthenticateWithCredential/);
  assert.match(dashboard, /EmailAuthProvider\.credential/);
  assert.match(dashboard, /\/api\/session\/change-password/);
});

test('forced activation password change ends the old session instead of refreshing a revoked session', () => {
  assert.ok(rotateStart >= 0 && rotateEnd > rotateStart);
  assert.match(rotateBlock, /await signOut\(auth\)/);
  assert.doesNotMatch(rotateBlock, /getIdTokenResult\(true\)/);
});

test('password-change API uses a recent-auth verifier rather than the revocation-check verifier', () => {
  assert.match(route, /requireRecentFirebaseUser/);
  assert.doesNotMatch(route, /requireFirebaseUser\(request\)/);
});

test('recent-auth policy accepts fresh auth_time and rejects stale sessions', () => {
  assert.equal(typeof accessPolicy.assertRecentAuthentication, 'function');
  if (typeof accessPolicy.assertRecentAuthentication !== 'function') return;
  assert.doesNotThrow(() => accessPolicy.assertRecentAuthentication({ auth_time: 1_000 }, 1_120, 300));
  assert.throws(() => accessPolicy.assertRecentAuthentication({ auth_time: 1_000 }, 1_400, 300), /RECENT_AUTH_REQUIRED/);
  assert.throws(() => accessPolicy.assertRecentAuthentication({}, 1_100, 300), /RECENT_AUTH_REQUIRED/);
});
