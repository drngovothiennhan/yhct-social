import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertAcceptableNewPassword,
  canUseProtectedFeatures,
} from '../lib/domain/password-rotation.ts';

test('protected features are blocked until temporary password is changed', () => {
  assert.equal(canUseProtectedFeatures({ mustChangePassword: true }), false);
  assert.equal(canUseProtectedFeatures({ mustChangePassword: false }), true);
  assert.equal(canUseProtectedFeatures({}), true);
});

test('new password must be at least 10 chars and cannot equal MSSV', () => {
  assert.throws(() => assertAcceptableNewPassword('123456789', '2413120084'), /10/);
  assert.throws(() => assertAcceptableNewPassword('2413120084', '2413120084'), /MSSV/);
  assert.doesNotThrow(() => assertAcceptableNewPassword('HocYHCT#2026!', '2413120084'));
});
