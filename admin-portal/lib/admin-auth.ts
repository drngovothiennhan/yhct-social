import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from './firebase-admin';
import { assertAccClaims, claimsFromDecodedToken, type AccClaims } from './access-policy';
import type { AccRole } from './rbac';

export class AccHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function bearerToken(request: Request): string {
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) throw new AccHttpError(401, 'UNAUTHORIZED');
  const token = header.slice(7).trim();
  if (!token) throw new AccHttpError(401, 'UNAUTHORIZED');
  return token;
}

export interface AccPrincipal {
  token: DecodedIdToken;
  claims: AccClaims;
}

export async function requireFirebaseUser(request: Request): Promise<DecodedIdToken> {
  try {
    return await adminAuth().verifyIdToken(bearerToken(request), true);
  } catch (error) {
    if (error instanceof AccHttpError) throw error;
    throw new AccHttpError(401, 'UNAUTHORIZED');
  }
}

export async function requireAccRole(request: Request, minimumRole: AccRole): Promise<AccPrincipal> {
  const decoded = await requireFirebaseUser(request);
  const claims = claimsFromDecodedToken(decoded as unknown as Record<string, unknown>);
  try {
    assertAccClaims(claims, minimumRole);
  } catch (error) {
    const message = error instanceof Error ? error.message : '403 FORBIDDEN';
    throw new AccHttpError(403, message.includes('PASSWORD_ROTATION_REQUIRED')
      ? 'PASSWORD_ROTATION_REQUIRED'
      : 'FORBIDDEN');
  }
  return { token: decoded, claims };
}

export function accErrorResponse(error: unknown): Response {
  if (error instanceof AccHttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error('ACC_API_ERROR', error instanceof Error ? error.message : 'unknown');
  return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
}
