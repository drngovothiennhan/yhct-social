import { FieldValue } from 'firebase-admin/firestore';
import { AccHttpError, accErrorResponse, requireAccRole } from '@/lib/admin-auth';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    await requireAccRole(request, 'mod');
    const snapshot = await adminDb().collection('system').doc('config').get();
    const data = snapshot.data() ?? {};
    return Response.json({ maintenanceMode: data.maintenanceMode === true });
  } catch (error) {
    return accErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const principal = await requireAccRole(request, 'admin');
    const body = await request.json() as { enabled?: unknown; message?: unknown };
    if (typeof body.enabled !== 'boolean') throw new AccHttpError(400, 'INVALID_MAINTENANCE_STATE');
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 240) : '';
    await adminDb().collection('system').doc('config').set({
      maintenanceMode: body.enabled,
      maintenanceMessage: message,
      maintenanceUpdatedBy: principal.token.uid,
      maintenanceUpdatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return Response.json({ ok: true, maintenanceMode: body.enabled });
  } catch (error) {
    return accErrorResponse(error);
  }
}
