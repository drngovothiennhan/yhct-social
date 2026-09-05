import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const authCard = readFileSync(new URL('../components/auth/auth-card.tsx', import.meta.url), 'utf8');
const portalShell = readFileSync(new URL('../components/portal/portal-shell.tsx', import.meta.url), 'utf8');
const route = readFileSync(new URL('../app/api/session/change-password/route.ts', import.meta.url), 'utf8');
const provisioning = readFileSync(new URL('../scripts/provision-members.mjs', import.meta.url), 'utf8');

test('public login accepts raw MSSV without browser email validation blocking submission', () => {
  assert.match(authCard, /MSSV hoặc email/);
  assert.match(authCard, /autoComplete=\{mode === 'login' \? 'username' : 'email'\}/);
  assert.match(authCard, /type=\{mode === 'login' \? 'text' : 'email'\}/);
  assert.doesNotMatch(authCard, /type="email"[\s\S]{0,240}value=\{values\.email\}/);
});

test('first login is not blocked by mandatory password rotation in the public portal', () => {
  assert.doesNotMatch(authCard, /if \(user && claims\?\.mustChangePassword === true\)/);
  assert.doesNotMatch(authCard, /Đổi mật khẩu kích hoạt/);
  assert.doesNotMatch(portalShell, /claims\?\.mustChangePassword/);
});

test('newly provisioned accounts do not require a first-login password change', () => {
  assert.match(provisioning, /const mustChangePassword = false;/);
  assert.doesNotMatch(provisioning, /created \? true : previousClaims\.mustChangePassword !== false/);
});

test('voluntary public password change remains recent-auth server-authoritative', () => {
  assert.match(route, /verifyIdToken\(bearerToken\(request\)\)/);
  assert.match(route, /assertRecentAuthentication/);
  assert.match(route, /assertAcceptableNewPassword/);
  assert.match(route, /updateUser\(decoded\.uid, \{ password: body\.password \}\)/);
  assert.match(route, /mustChangePassword: false/);
  assert.match(route, /lastPasswordChangedAt: FieldValue\.serverTimestamp\(\)/);
});

test('portal does not show a dead-end password warning without the rotation action', () => {
  assert.doesNotMatch(portalShell, /Bạn cần đổi mật khẩu tạm thời trước khi đăng bài/);
});
