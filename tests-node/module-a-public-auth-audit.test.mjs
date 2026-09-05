import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const authCard = readFileSync(new URL('../components/auth/auth-card.tsx', import.meta.url), 'utf8');
const portalShell = readFileSync(new URL('../components/portal/portal-shell.tsx', import.meta.url), 'utf8');
const route = readFileSync(new URL('../app/api/session/change-password/route.ts', import.meta.url), 'utf8');

test('public login accepts raw MSSV without browser email validation blocking submission', () => {
  assert.match(authCard, /MSSV hoặc email/);
  assert.match(authCard, /autoComplete=\{mode === 'login' \? 'username' : 'email'\}/);
  assert.match(authCard, /type=\{mode === 'login' \? 'text' : 'email'\}/);
  assert.doesNotMatch(authCard, /type="email"[\s\S]{0,240}value=\{values\.email\}/);
});

test('users flagged for mandatory password rotation receive an actionable password-change form', () => {
  assert.match(authCard, /mustChangePassword/);
  assert.match(authCard, /Đổi mật khẩu kích hoạt/);
  assert.match(authCard, /Mật khẩu hiện tại/);
  assert.match(authCard, /Xác nhận mật khẩu mới/);
  assert.match(authCard, /reauthenticateWithCredential/);
  assert.match(authCard, /\/api\/session\/change-password/);
});

test('public password rotation is recent-auth server-authoritative and clears the rotation flag', () => {
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
