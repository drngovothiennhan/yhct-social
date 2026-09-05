import assert from 'node:assert/strict';
import test from 'node:test';
import { assertRecoveryTransition, validateOperationId, validateRecoveryMode, validateRecoveryReason } from '../lib/recovery-policy.ts';

test('recovery state machine accepts only approved transitions', () => {
  assert.doesNotThrow(() => assertRecoveryTransition('normal', 'degraded'));
  assert.doesNotThrow(() => assertRecoveryTransition('degraded', 'normal'));
  assert.doesNotThrow(() => assertRecoveryTransition('normal', 'safe_mode'));
  assert.doesNotThrow(() => assertRecoveryTransition('safe_mode', 'restoring'));
  assert.doesNotThrow(() => assertRecoveryTransition('restoring', 'safe_mode'));
  assert.doesNotThrow(() => assertRecoveryTransition('restoring', 'normal'));
  assert.throws(() => assertRecoveryTransition('restoring', 'degraded'), /RECOVERY_STATE_CONFLICT/);
  assert.throws(() => assertRecoveryTransition('closed', 'normal'), /RECOVERY_MODE_INVALID/);
});

test('recovery validators reject empty or oversized control input', () => {
  assert.equal(validateRecoveryMode('safe_mode'), 'safe_mode');
  assert.equal(validateOperationId(' op-123 '), 'op-123');
  assert.equal(validateRecoveryReason(' maintenance '), 'maintenance');
  assert.throws(() => validateRecoveryMode('repairing'), /RECOVERY_MODE_INVALID/);
  assert.throws(() => validateOperationId(''), /RECOVERY_OPERATION_ID_INVALID/);
  assert.throws(() => validateRecoveryReason(''), /RECOVERY_REASON_INVALID/);
  assert.throws(() => validateRecoveryReason('x'.repeat(2001)), /RECOVERY_REASON_INVALID/);
});
