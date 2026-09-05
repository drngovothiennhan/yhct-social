import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertActivityTransition,
  validateOperationId,
  validatePointValue,
  validateReason,
  validateScoringPolicy,
} from '../lib/activity-policy.ts';

test('Module D allows only approved activity lifecycle transitions', () => {
  assert.doesNotThrow(() => assertActivityTransition('draft', 'published'));
  assert.doesNotThrow(() => assertActivityTransition('draft', 'cancelled'));
  assert.doesNotThrow(() => assertActivityTransition('published', 'closed'));
  assert.doesNotThrow(() => assertActivityTransition('published', 'cancelled'));
  assert.throws(() => assertActivityTransition('closed', 'published'), /ACTIVITY_TRANSITION_INVALID/);
  assert.throws(() => assertActivityTransition('cancelled', 'draft'), /ACTIVITY_TRANSITION_INVALID/);
  assert.throws(() => assertActivityTransition('published', 'draft'), /ACTIVITY_TRANSITION_INVALID/);
});

test('Module D point entries are non-zero bounded integers', () => {
  assert.equal(validatePointValue(1000), 1000);
  assert.equal(validatePointValue(-1000), -1000);
  assert.equal(validatePointValue(1), 1);
  assert.throws(() => validatePointValue(0), /POINT_VALUE_INVALID/);
  assert.throws(() => validatePointValue(1001), /POINT_VALUE_INVALID/);
  assert.throws(() => validatePointValue(-1001), /POINT_VALUE_INVALID/);
  assert.throws(() => validatePointValue(2.5), /POINT_VALUE_INVALID/);
});

test('Module D scoring policy is explicit and bounded', () => {
  assert.deepEqual(validateScoringPolicy({ attendancePoints: 10, maxBonusPoints: 20, notes: '  Chính sách hoạt động  ', version: 1 }), {
    attendancePoints: 10,
    maxBonusPoints: 20,
    notes: 'Chính sách hoạt động',
    version: 1,
  });
  assert.throws(() => validateScoringPolicy({ attendancePoints: -1, maxBonusPoints: 20, notes: '', version: 1 }), /SCORING_POLICY_INVALID/);
  assert.throws(() => validateScoringPolicy({ attendancePoints: 10, maxBonusPoints: 1001, notes: '', version: 1 }), /SCORING_POLICY_INVALID/);
  assert.throws(() => validateScoringPolicy({ attendancePoints: 1.5, maxBonusPoints: 2, notes: '', version: 1 }), /SCORING_POLICY_INVALID/);
});

test('Module D operation IDs and reasons reject ambiguous values', () => {
  assert.equal(validateOperationId(' op-123 '), 'op-123');
  assert.equal(validateReason('  Điều chỉnh sau đối soát  '), 'Điều chỉnh sau đối soát');
  assert.throws(() => validateOperationId(''), /OPERATION_ID_INVALID/);
  assert.throws(() => validateOperationId('bad/id'), /OPERATION_ID_INVALID/);
  assert.throws(() => validateReason(''), /REASON_INVALID/);
});
