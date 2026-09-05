import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assertAccClaims,
  claimsFromDecodedToken,
} from '../lib/access-policy.ts';

const authGate = readFileSync(new URL('../app/auth-gate.tsx', import.meta.url), 'utf8');

test('ACC rejects insufficient roles but does not block first login for password rotation', () => {
  assert.throws(() => assertAccClaims({ role: 'member', clubMember: true, mustChangePassword: false }, 'mod'), /403/);
  assert.doesNotThrow(() => assertAccClaims({ role: 'admin', clubMember: true, mustChangePassword: true }, 'mod'));
});

test('ACC accepts sufficient claims and normalizes legacy moderator', () => {
  assert.doesNotThrow(() => assertAccClaims({ role: 'super_mod', clubMember: true, mustChangePassword: false }, 'mod'));
  assert.equal(claimsFromDecodedToken({ role: 'moderator', clubMember: true, mustChangePassword: false }).role, 'mod');
});

test('club membership claim is mandatory for ACC', () => {
  assert.throws(() => assertAccClaims({ role: 'admin', clubMember: false, mustChangePassword: false }, 'mod'), /403/);
});

test('ACC auth gate does not force a first-login password change screen', () => {
  assert.doesNotMatch(authGate, /if \(claims\?\.mustChangePassword === true\)/);
  assert.doesNotMatch(authGate, /BẢO MẬT LẦN ĐẦU/);
  assert.doesNotMatch(authGate, /Đổi mật khẩu kích hoạt/);
});
