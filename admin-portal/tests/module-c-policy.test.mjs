import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canModerate,
  canRestore,
  canDecideVerification,
  canReadFullAudit,
} from '../lib/module-c-policy.ts';

test('moderation starts at mod but restore starts at super_mod', () => {
  assert.equal(canModerate('member'), false);
  assert.equal(canModerate('mod'), true);
  assert.equal(canRestore('mod'), false);
  assert.equal(canRestore('super_mod'), true);
  assert.equal(canRestore('admin'), true);
});

test('verification decisions require super_mod or admin', () => {
  assert.equal(canDecideVerification('mod'), false);
  assert.equal(canDecideVerification('super_mod'), true);
  assert.equal(canDecideVerification('admin'), true);
});

test('full audit browsing is admin only', () => {
  assert.equal(canReadFullAudit('super_mod'), false);
  assert.equal(canReadFullAudit('admin'), true);
});
