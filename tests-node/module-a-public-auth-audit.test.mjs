import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const authCard = readFileSync(new URL('../components/auth/auth-card.tsx', import.meta.url), 'utf8');
const portalShell = readFileSync(new URL('../components/portal/portal-shell.tsx', import.meta.url), 'utf8');

test('public login accepts raw MSSV without browser email validation blocking submission', () => {
  assert.match(authCard, /MSSV hoặc email/);
  assert.match(authCard, /autoComplete="username"/);
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

test('portal does not show a dead-end password warning without the rotation action', () => {
  assert.doesNotMatch(portalShell, /Bạn cần đổi mật khẩu tạm thời trước khi đăng bài/);
});
