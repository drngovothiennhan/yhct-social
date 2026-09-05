import { FieldValue } from 'firebase-admin/firestore';
import { assertAcceptableNewPassword } from '@/lib/domain/password-rotation';
import { rootAdminAuth, rootAdminDb } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';

class SessionHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function bearerToken(request: Request): string {
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) throw new SessionHttpError(401, 'UNAUTHORIZED');
  const token = header.slice(7).trim();
  if (!token) throw new SessionHttpError(401, 'UNAUTHORIZED');
  return token;
}

function assertRecentAuthentication(token: Record<string, unknown>, maxAgeSeconds = 300): void {
  const authTime = typeof token.auth_time === 'number' ? token.auth_time : 0;
  const now = Math.floor(Date.now() / 1000);
  if (!authTime || now - authTime > maxAgeSeconds) throw new SessionHttpError(401, 'RECENT_AUTH_REQUIRED');
}

export async function POST(request: Request) {
  try {
    const decoded = await rootAdminAuth().verifyIdToken(bearerToken(request));
    assertRecentAuthentication(decoded as unknown as Record<string, unknown>);

    const body = await request.json() as { password?: unknown };
    if (typeof body.password !== 'string') throw new SessionHttpError(400, 'PASSWORD_REQUIRED');

    const accessRef = rootAdminDb().collection('users').doc(decoded.uid).collection('private').doc('access');
    const access = await accessRef.get();
    const memberCode = String(access.data()?.studentId ?? access.data()?.memberCode ?? '');
    try {
      assertAcceptableNewPassword(body.password, memberCode);
    } catch (error) {
      throw new SessionHttpError(400, error instanceof Error ? error.message : 'INVALID_PASSWORD');
    }

    const user = await rootAdminAuth().getUser(decoded.uid);
    await rootAdminAuth().updateUser(decoded.uid, { password: body.password });
    await rootAdminAuth().setCustomUserClaims(decoded.uid, {
      ...(user.customClaims ?? {}),
      mustChangePassword: false,
    });
    await accessRef.set({
      mustChangePassword: false,
      lastPasswordChangedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof SessionHttpError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error('PUBLIC_PASSWORD_ROTATION_ERROR', error instanceof Error ? error.name : 'unknown');
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
