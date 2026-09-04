import test from 'node:test';
import assert from 'node:assert/strict';
import { assertVerificationDecision, normalizeVerificationStatus } from '../lib/verification.ts';
import { readFile } from 'node:fs/promises';

const route = await readFile(new URL('../app/api/verification/requests/[uid]/route.ts', import.meta.url), 'utf8').catch(() => '');

test('verification decisions only start from pending', () => {
  assert.doesNotThrow(() => assertVerificationDecision({ currentStatus: 'pending', decision: 'verified', reason: '' }));
  assert.throws(() => assertVerificationDecision({ currentStatus: 'verified', decision: 'rejected', reason: 'x' }), /conflict/i);
  assert.throws(() => assertVerificationDecision({ currentStatus: 'pending', decision: 'rejected', reason: '' }), /reason/i);
});

test('legacy profile verification values normalize safely', () => {
  assert.equal(normalizeVerificationStatus('not_required'), 'unsubmitted');
  assert.equal(normalizeVerificationStatus('pending'), 'pending');
  assert.equal(normalizeVerificationStatus('verified'), 'verified');
});

test('trusted verification route requires super_mod and transaction helper', () => {
  assert.match(route, /requireAccRole\(request, 'super_mod'\)/);
  assert.match(route, /decideVerificationTransaction/);
  assert.match(route, /operationId/);
});
