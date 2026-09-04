export type ClubRole = 'member' | 'mod' | 'super_mod' | 'admin';
export type RoleInput = ClubRole | 'moderator';

const ROLE_RANK: Record<ClubRole, number> = {
  member: 0,
  mod: 1,
  super_mod: 2,
  admin: 3,
};

export function normalizeClubRole(role: RoleInput | string): ClubRole {
  if (role === 'moderator') return 'mod';
  if (role === 'member' || role === 'mod' || role === 'super_mod' || role === 'admin') {
    return role;
  }
  return 'member';
}

export function roleRank(role: RoleInput | string): number {
  return ROLE_RANK[normalizeClubRole(role)];
}

export function hasMinimumRole(
  actualRole: RoleInput | string,
  minimumRole: ClubRole,
): boolean {
  return roleRank(actualRole) >= roleRank(minimumRole);
}

export function canAssignRole(
  actorRole: RoleInput | string,
  currentTargetRole: RoleInput | string,
  nextTargetRole: ClubRole,
): boolean {
  const actor = normalizeClubRole(actorRole);
  const current = normalizeClubRole(currentTargetRole);

  if (actor === 'admin') return true;
  if (actor !== 'super_mod') return false;
  if (current === 'admin' || nextTargetRole === 'admin') return false;
  return roleRank(nextTargetRole) <= roleRank('mod');
}
