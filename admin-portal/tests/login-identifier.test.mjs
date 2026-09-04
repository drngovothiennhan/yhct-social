import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAccLoginIdentifier } from '../lib/login-identifier.ts';

test('ACC accepts MSSV or email identifiers', () => {
  assert.equal(normalizeAccLoginIdentifier(' 2413120084 '), '2413120084@members.yhct.hiu.vn');
  assert.equal(normalizeAccLoginIdentifier('Admin@Example.COM'), 'admin@example.com');
  assert.throws(() => normalizeAccLoginIdentifier('bad user'), /MSSV|email/);
});
