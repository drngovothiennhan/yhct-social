import { hasMinimumAccRole, normalizeAccRole, type AccRole } from './rbac.ts';

export interface AccClaims {
  role: AccRole;
  clubMember: boolean;
  mustChangePassword: boolean;
}

export function claimsFromDecodedToken(token: Record<string, unknown>): AccClaims {
  return {
    role: normalizeAccRole(token.role),
    clubMember: token.clubMember === true,
    mustChangePassword: token.mustChangePassword === true,
  };
}

export function assertAccClaims(claims: AccClaims, minimumRole: AccRole): void {
  if (claims.mustChangePassword) {
    throw new Error('403 PASSWORD_ROTATION_REQUIRED');
  }
  if (!claims.clubMember || !hasMinimumAccRole(claims.role, minimumRole)) {
    throw new Error('403 FORBIDDEN');
  }
}
