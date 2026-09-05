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

export function assertRecentAuthentication(
  token: Record<string, unknown>,
  nowSeconds = Math.floor(Date.now() / 1000),
  maxAgeSeconds = 300,
): void {
  const authTime = typeof token.auth_time === 'number' ? token.auth_time : Number.NaN;
  const age = nowSeconds - authTime;
  if (!Number.isFinite(authTime) || authTime <= 0 || age < -60 || age > maxAgeSeconds) {
    throw new Error('RECENT_AUTH_REQUIRED');
  }
}

export function assertAccClaims(claims: AccClaims, minimumRole: AccRole): void {
  if (!claims.clubMember || !hasMinimumAccRole(claims.role, minimumRole)) {
    throw new Error('403 FORBIDDEN');
  }
}
