import { hasMinimumAccRole } from './rbac.ts';

export function canSyncAiKnowledge(role: unknown): boolean {
  return hasMinimumAccRole(role, 'mod');
}

export function canDeleteAiKnowledge(role: unknown): boolean {
  return hasMinimumAccRole(role, 'super_mod');
}
