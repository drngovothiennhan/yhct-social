import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertAccClaims,
  claimsFromDecodedToken,
} from '../lib/access-policy.ts';

test('ACC rejects member and password-rotation sessions', () => {
  assert.throws(() => assertAccClaims({ role: 'member', clubMember: true, mustChangePassword: false }, 'mod'), /403/);
  assert.throws(() => assertAccClaims({ role: 'admin', clubMember: true, mustChangePassword: true }, 'mod'), /PASSWORD_ROTATION_REQUIRED/);
});

test('ACC accepts sufficient claims and normalizes legacy moderator', () => {
  assert.doesNotThrow(() => assertAccClaims({ role: 'super_mod', clubMember: true, mustChangePassword: false }, 'mod'));
  assert.equal(claimsFromDecodedToken({ role: 'moderator', clubMember: true, mustChangePassword: false }).role, 'mod');
});

test('club membership claim is mandatory for ACC', () => {
  assert.throws(() => assertAccClaims({ role: 'admin', clubMember: false, mustChangePassword: false }, 'mod'), /403/);
});
