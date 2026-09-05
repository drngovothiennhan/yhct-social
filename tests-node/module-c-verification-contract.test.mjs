import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVerificationSubmission, buildVerificationEvidencePath } from '../lib/domain/verification-request.ts';

test('verification submission is pending-only and evidence is owner-scoped', () => {
  assert.throws(() => validateVerificationSubmission({ uid: 'u1', status: 'verified', professionalType: 'Bác sĩ YHCT', evidence: [], attempt: 1 }), /pending/i);
  assert.doesNotThrow(() => validateVerificationSubmission({ uid: 'u1', status: 'pending', professionalType: 'Bác sĩ YHCT', evidence: [{ storagePath: 'certificates/u1/license.pdf', type: 'license', label: 'Giấy phép' }], attempt: 1 }));
  assert.throws(() => validateVerificationSubmission({ uid: 'u1', status: 'pending', professionalType: 'Bác sĩ YHCT', evidence: [{ storagePath: 'certificates/u2/license.pdf', type: 'license', label: 'Sai chủ sở hữu' }], attempt: 1 }), /owner/i);
});

test('evidence path stays in existing private certificates subtree', () => {
  assert.equal(buildVerificationEvidencePath('u1', 'license.pdf'), 'certificates/u1/license.pdf');
});
