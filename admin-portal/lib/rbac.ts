export type AccRole = 'member' | 'mod' | 'super_mod' | 'admin';

const RANK: Record<AccRole, number> = {
  member: 0,
  mod: 1,
  super_mod: 2,
  admin: 3,
};

export function normalizeAccRole(value: unknown): AccRole {
  if (value === 'moderator') return 'mod';
  if (value === 'member' || value === 'mod' || value === 'super_mod' || value === 'admin') {
    return value;
  }
  return 'member';
}

export function hasMinimumAccRole(actual: unknown, minimum: AccRole): boolean {
  return RANK[normalizeAccRole(actual)] >= RANK[minimum];
}

export function canSetRole(actor: unknown, currentTarget: unknown, nextTarget: AccRole): boolean {
  const actorRole = normalizeAccRole(actor);
  const currentRole = normalizeAccRole(currentTarget);
  if (actorRole === 'admin') return true;
  if (actorRole !== 'super_mod') return false;
  if (currentRole === 'admin' || currentRole === 'super_mod') return false;
  return nextTarget === 'member' || nextTarget === 'mod';
}

export function canDisableAccount(actor: unknown, target: unknown): boolean {
  const actorRole = normalizeAccRole(actor);
  const targetRole = normalizeAccRole(target);
  if (actorRole === 'admin') return targetRole !== 'admin';
  if (actorRole === 'super_mod') return targetRole === 'member' || targetRole === 'mod';
  return false;
}

export function canEditClubTitle(actor: unknown, target: unknown): boolean {
  const actorRole = normalizeAccRole(actor);
  const targetRole = normalizeAccRole(target);
  if (actorRole === 'admin') return true;
  if (actorRole === 'super_mod') return targetRole === 'member' || targetRole === 'mod';
  return false;
}

export function canManageVerification(actor: unknown): boolean {
  return hasMinimumAccRole(actor, 'mod');
}
