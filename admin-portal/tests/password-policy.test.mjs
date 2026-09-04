import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReplacementPassword } from '../lib/password-policy.ts';

test('ACC password replacement rejects short and MSSV-equivalent passwords', () => {
  assert.throws(() => validateReplacementPassword('123456789', '2413120084'), /10/);
  assert.throws(() => validateReplacementPassword('2413120084', '2413120084'), /MSSV/);
  assert.doesNotThrow(() => validateReplacementPassword('YHCT#Beta2026', '2413120084'));
});
