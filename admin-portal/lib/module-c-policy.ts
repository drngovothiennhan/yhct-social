import { hasMinimumAccRole, normalizeAccRole } from './rbac.ts';

export function canModerate(role: unknown): boolean {
  return hasMinimumAccRole(role, 'mod');
}

export function canRestore(role: unknown): boolean {
  return hasMinimumAccRole(role, 'super_mod');
}

export function canDecideVerification(role: unknown): boolean {
  return hasMinimumAccRole(role, 'super_mod');
}

export function canReadFullAudit(role: unknown): boolean {
  return normalizeAccRole(role) === 'admin';
}
