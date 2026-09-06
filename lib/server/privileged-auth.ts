import type { DecodedIdToken } from 'firebase-admin/auth';
import { rootAdminAuth, rootAdminDb } from '@/lib/server/firebase-admin';
import { normalizeClubRole, roleRank, type ClubRole } from '@/lib/domain/rbac';

export class PrivilegedHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'PrivilegedHttpError';
  }
}

export interface PrivilegedPrincipal {
  uid: string;
  role: ClubRole;
  department: string;
  claims: DecodedIdToken;
}

function bearerToken(request: Request): string {
  const header = request.headers.get('authorization')?.trim() ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match?.[1]) throw new PrivilegedHttpError(401, 'UNAUTHORIZED');
  return match[1];
}

export async function requirePrivileged(
  request: Request,
  minimumRole: ClubRole = 'mod',
): Promise<PrivilegedPrincipal> {
  let decoded: DecodedIdToken;
  try {
    decoded = await rootAdminAuth().verifyIdToken(bearerToken(request), true);
  } catch (error) {
    if (error instanceof PrivilegedHttpError) throw error;
    throw new PrivilegedHttpError(401, 'UNAUTHORIZED');
  }

  if (decoded.clubMember !== true || decoded.mustChangePassword === true) {
    throw new PrivilegedHttpError(403, 'FORBIDDEN');
  }

  const role = normalizeClubRole(typeof decoded.role === 'string' ? decoded.role : 'member');
  if (roleRank(role) < roleRank(minimumRole)) {
    throw new PrivilegedHttpError(403, 'FORBIDDEN');
  }

  const userSnapshot = await rootAdminDb().collection('users').doc(decoded.uid).get();
  if (!userSnapshot.exists || userSnapshot.data()?.accountStatus === 'disabled') {
    throw new PrivilegedHttpError(403, 'FORBIDDEN');
  }

  const department = String(decoded.department ?? userSnapshot.data()?.department ?? '').trim();
  return { uid: decoded.uid, role, department, claims: decoded };
}

export function requireSameDepartment(
  principal: PrivilegedPrincipal,
  targetDepartment: string,
): void {
  if (principal.role === 'admin' || principal.role === 'super_mod') return;
  if (!principal.department || principal.department !== targetDepartment.trim()) {
    throw new PrivilegedHttpError(403, 'FORBIDDEN');
  }
}

export function privilegedErrorResponse(error: unknown): Response {
  if (error instanceof PrivilegedHttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error('PRIVILEGED_API_ERROR', error instanceof Error ? error.name : 'unknown');
  return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
}
