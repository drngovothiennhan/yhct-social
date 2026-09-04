import { FieldValue } from 'firebase-admin/firestore';
import { AccHttpError, accErrorResponse, requireFirebaseUser } from '@/lib/admin-auth';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { validateReplacementPassword } from '@/lib/password-policy';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const decoded = await requireFirebaseUser(request);
    const body = await request.json() as { password?: unknown };
    if (typeof body.password !== 'string') throw new AccHttpError(400, 'PASSWORD_REQUIRED');

    const accessRef = adminDb().collection('users').doc(decoded.uid).collection('private').doc('access');
    const access = await accessRef.get();
    const memberCode = String(access.data()?.memberCode ?? '');
    try {
      validateReplacementPassword(body.password, memberCode);
    } catch (error) {
      throw new AccHttpError(400, error instanceof Error ? error.message : 'INVALID_PASSWORD');
    }

    const user = await adminAuth().getUser(decoded.uid);
    await adminAuth().updateUser(decoded.uid, { password: body.password });
    await adminAuth().setCustomUserClaims(decoded.uid, {
      ...(user.customClaims ?? {}),
      mustChangePassword: false,
    });
    await accessRef.set({
      mustChangePassword: false,
      lastPasswordChangedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return Response.json({ ok: true, refreshToken: true });
  } catch (error) {
    return accErrorResponse(error);
  }
}
