import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as accessPolicy from '../lib/access-policy.ts';

const shell = readFileSync(new URL('../app/acc-shell.tsx', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../app/dashboard.tsx', import.meta.url), 'utf8');
const authGate = readFileSync(new URL('../app/auth-gate.tsx', import.meta.url), 'utf8');
const adminAuth = readFileSync(new URL('../lib/admin-auth.ts', import.meta.url), 'utf8');
const route = readFileSync(new URL('../app/api/session/change-password/route.ts', import.meta.url), 'utf8');
const rotateStart = authGate.indexOf('async function rotatePassword');
const rotateEnd = authGate.indexOf('\n  if (!user) return <main', rotateStart);
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
  assert.match(dashboard, /getIdToken\(true\)/);
  assert.match(dashboard, /\/api\/session\/change-password/);
});

test('forced activation password change ends the old session instead of refreshing a revoked session', () => {
  assert.ok(rotateStart >= 0 && rotateEnd > rotateStart);
  assert.match(rotateBlock, /\/api\/session\/change-password/);
  assert.match(rotateBlock, /await signOut\(auth\)/);
  assert.doesNotMatch(rotateBlock, /getIdTokenResult\(true\)/);
});

test('password route remains server-owned while only that route uses recent-auth verification', () => {
  assert.match(route, /requireFirebaseUser\(request\)/);
  assert.match(route, /validateReplacementPassword/);
  assert.match(route, /updateUser/);
  assert.match(adminAuth, /pathname === '\/api\/session\/change-password'/);
  assert.match(adminAuth, /return requireRecentFirebaseUser\(request\)/);
  assert.match(adminAuth, /verifyIdToken\(bearerToken\(request\), true\)/);
});

test('recent-auth policy accepts fresh auth_time and rejects stale sessions', () => {
  assert.equal(typeof accessPolicy.assertRecentAuthentication, 'function');
  assert.doesNotThrow(() => accessPolicy.assertRecentAuthentication({ auth_time: 1_000 }, 1_120, 300));
  assert.throws(() => accessPolicy.assertRecentAuthentication({ auth_time: 1_000 }, 1_400, 300), /RECENT_AUTH_REQUIRED/);
  assert.throws(() => accessPolicy.assertRecentAuthentication({}, 1_100, 300), /RECENT_AUTH_REQUIRED/);
});
