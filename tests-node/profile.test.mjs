import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNewUserProfile } from '../lib/domain/profile.ts';

test('practitioner profile starts as member and unsubmitted', () => {
  const profile = buildNewUserProfile({
    uid: 'u1',
    displayName: 'BS. Nguyễn An',
    photoURL: 'https://example.com/avatar.jpg',
    accountType: 'practitioner',
  });
  assert.equal(profile.role, 'member');
  assert.equal(profile.verificationStatus, 'unsubmitted');
  assert.equal(profile.professionalTitle, '');
  assert.deepEqual(profile.specialties, []);
});

test('non-practitioner profile does not require professional verification', () => {
  const profile = buildNewUserProfile({
    uid: 'u2', displayName: 'Nguyễn Bình', photoURL: '', accountType: 'member',
  });
  assert.equal(profile.verificationStatus, 'not_required');
});
