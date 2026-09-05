export type RecoveryMode = 'normal' | 'degraded' | 'safe_mode' | 'restoring';

const MODES = new Set<RecoveryMode>(['normal', 'degraded', 'safe_mode', 'restoring']);

const TRANSITIONS: Record<RecoveryMode, ReadonlySet<RecoveryMode>> = {
  normal: new Set(['degraded', 'safe_mode', 'restoring']),
  degraded: new Set(['normal', 'safe_mode']),
  safe_mode: new Set(['normal', 'restoring']),
  restoring: new Set(['safe_mode', 'normal']),
};

export function validateRecoveryMode(value: unknown): RecoveryMode {
  if (typeof value !== 'string' || !MODES.has(value as RecoveryMode)) throw new Error('RECOVERY_MODE_INVALID');
  return value as RecoveryMode;
}

export function validateOperationId(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > 120 || normalized.includes('/')) throw new Error('RECOVERY_OPERATION_ID_INVALID');
  return normalized;
}

export function validateRecoveryReason(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > 2000) throw new Error('RECOVERY_REASON_INVALID');
  return normalized;
}

export function assertRecoveryTransition(fromValue: unknown, toValue: unknown): void {
  const from = validateRecoveryMode(fromValue);
  const to = validateRecoveryMode(toValue);
  if (from === to) return;
  if (!TRANSITIONS[from].has(to)) throw new Error('RECOVERY_STATE_CONFLICT');
}
