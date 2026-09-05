import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canDisableAccount,
  canEditClubTitle,
  canManageVerification,
  canSetRole,
  hasMinimumAccRole,
  normalizeAccRole,
} from '../lib/rbac.ts';

test('ACC accepts legacy moderator as mod during migration', () => {
  assert.equal(normalizeAccRole('moderator'), 'mod');
});

test('only privileged roles enter ACC', () => {
  assert.equal(hasMinimumAccRole('member', 'mod'), false);
  assert.equal(hasMinimumAccRole('mod', 'mod'), true);
  assert.equal(hasMinimumAccRole('super_mod', 'mod'), true);
  assert.equal(hasMinimumAccRole('admin', 'admin'), true);
});

test('super_mod cannot assign or modify admin and cannot create super_mod', () => {
  assert.equal(canSetRole('super_mod', 'member', 'mod'), true);
  assert.equal(canSetRole('super_mod', 'member', 'super_mod'), false);
  assert.equal(canSetRole('super_mod', 'member', 'admin'), false);
  assert.equal(canSetRole('super_mod', 'admin', 'member'), false);
});

test('admin can assign club roles', () => {
  assert.equal(canSetRole('admin', 'member', 'super_mod'), true);
  assert.equal(canSetRole('admin', 'super_mod', 'member'), true);
});

test('account disable boundary protects admin and super_mod from super_mod actor', () => {
  assert.equal(canDisableAccount('super_mod', 'member'), true);
  assert.equal(canDisableAccount('super_mod', 'mod'), true);
  assert.equal(canDisableAccount('super_mod', 'super_mod'), false);
  assert.equal(canDisableAccount('super_mod', 'admin'), false);
  assert.equal(canDisableAccount('admin', 'super_mod'), true);
});

test('title permissions follow role hierarchy and verification is tightened by Module C', () => {
  assert.equal(canEditClubTitle('super_mod', 'mod'), true);
  assert.equal(canEditClubTitle('super_mod', 'super_mod'), false);
  assert.equal(canManageVerification('mod'), false);
  assert.equal(canManageVerification('super_mod'), true);
  assert.equal(canManageVerification('admin'), true);
  assert.equal(canManageVerification('member'), false);
});
