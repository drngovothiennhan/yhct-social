import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAssignRole,
  hasMinimumRole,
  normalizeClubRole,
  roleRank,
} from '../lib/domain/rbac.ts';

test('legacy moderator normalizes to mod', () => {
  assert.equal(normalizeClubRole('moderator'), 'mod');
  assert.equal(normalizeClubRole('mod'), 'mod');
});

test('club roles have a strict ascending privilege order', () => {
  assert.equal(roleRank('member') < roleRank('mod'), true);
  assert.equal(roleRank('mod') < roleRank('super_mod'), true);
  assert.equal(roleRank('super_mod') < roleRank('admin'), true);
});

test('minimum-role authorization respects the hierarchy', () => {
  assert.equal(hasMinimumRole('super_mod', 'mod'), true);
  assert.equal(hasMinimumRole('mod', 'super_mod'), false);
  assert.equal(hasMinimumRole('admin', 'admin'), true);
});

test('admin can assign every role except changing their own admin ownership implicitly', () => {
  assert.equal(canAssignRole('admin', 'member', 'admin'), true);
  assert.equal(canAssignRole('admin', 'member', 'super_mod'), true);
  assert.equal(canAssignRole('admin', 'member', 'mod'), true);
});

test('super_mod cannot create or modify admin authority', () => {
  assert.equal(canAssignRole('super_mod', 'member', 'admin'), false);
  assert.equal(canAssignRole('super_mod', 'admin', 'member'), false);
  assert.equal(canAssignRole('super_mod', 'member', 'mod'), true);
});
