export type ActivityRegistrationMode = 'closed' | 'member_self_register';
export type ParticipationStatus = 'registered' | 'withdrawn' | 'attended' | 'absent' | 'excused';
export type PointEntryType = 'attendance' | 'bonus' | 'manual_adjustment' | 'reversal' | 'correction';

export const MODULE_D_DEFAULT_PAGE_SIZE = 30;
export const MODULE_D_MAX_PAGE_SIZE = 50;
export const MODULE_D_MAX_POINT_ABS = 1000;

export function boundedPageSize(value: unknown, defaultValue = MODULE_D_DEFAULT_PAGE_SIZE): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) return defaultValue;
  return Math.min(value, MODULE_D_MAX_PAGE_SIZE);
}
