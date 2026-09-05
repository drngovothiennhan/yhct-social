export type ActivityStatus = 'draft' | 'published' | 'closed' | 'cancelled';

export interface ActivityScoringPolicy {
  attendancePoints: number;
  maxBonusPoints: number;
  notes: string;
  version: 1;
}

const transitions: Record<ActivityStatus, ReadonlySet<ActivityStatus>> = {
  draft: new Set<ActivityStatus>(['published', 'cancelled']),
  published: new Set<ActivityStatus>(['closed', 'cancelled']),
  closed: new Set<ActivityStatus>(),
  cancelled: new Set<ActivityStatus>(),
};

export function assertActivityTransition(from: ActivityStatus, to: ActivityStatus): void {
  if (!transitions[from]?.has(to)) throw new Error('ACTIVITY_TRANSITION_INVALID');
}

export function validatePointValue(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value === 0 || Math.abs(value) > 1000) {
    throw new Error('POINT_VALUE_INVALID');
  }
  return value;
}

export function validateScoringPolicy(input: unknown): ActivityScoringPolicy {
  if (!input || typeof input !== 'object') throw new Error('SCORING_POLICY_INVALID');
  const value = input as Record<string, unknown>;
  const attendancePoints = value.attendancePoints;
  const maxBonusPoints = value.maxBonusPoints;
  const notes = typeof value.notes === 'string' ? value.notes.trim() : '';
  if (
    typeof attendancePoints !== 'number' || !Number.isInteger(attendancePoints) || attendancePoints < 0 || attendancePoints > 1000 ||
    typeof maxBonusPoints !== 'number' || !Number.isInteger(maxBonusPoints) || maxBonusPoints < 0 || maxBonusPoints > 1000 ||
    value.version !== 1 || notes.length > 2000
  ) {
    throw new Error('SCORING_POLICY_INVALID');
  }
  return { attendancePoints, maxBonusPoints, notes, version: 1 };
}

export function validateOperationId(value: unknown): string {
  if (typeof value !== 'string') throw new Error('OPERATION_ID_INVALID');
  const normalized = value.trim();
  if (!normalized || normalized.length > 120 || normalized.includes('/')) throw new Error('OPERATION_ID_INVALID');
  return normalized;
}

export function validateReason(value: unknown, max = 2000): string {
  if (typeof value !== 'string') throw new Error('REASON_INVALID');
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error('REASON_INVALID');
  return normalized;
}
