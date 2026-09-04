import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLoginIdentifier } from '../lib/domain/auth-identifier.ts';

test('plain MSSV becomes the internal member email alias', () => {
  assert.equal(normalizeLoginIdentifier(' 2413120001 '), '2413120001@members.yhct.hiu.vn');
});

test('normal email login remains unchanged and is lower-cased', () => {
  assert.equal(normalizeLoginIdentifier(' User@Example.COM '), 'user@example.com');
});

test('non-email non-MSSV identifiers are rejected', () => {
  assert.throws(() => normalizeLoginIdentifier('abc xyz'), /MSSV|email/);
});
