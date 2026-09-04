import { FieldValue } from 'firebase-admin/firestore';
import { accErrorResponse, requireAccRole, AccHttpError } from '@/lib/admin-auth';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const principal = await requireAccRole(request, 'mod');
    const { reportId } = await params;
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? '');
    if (!['claim', 'release', 'reopen'].includes(action)) throw new AccHttpError(400, 'INVALID_ACTION');
    if (action === 'reopen' && principal.claims.role === 'mod') throw new AccHttpError(403, 'FORBIDDEN');

    const ref = adminDb().doc(`reports/${reportId}`);
    await adminDb().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new AccHttpError(404, 'REPORT_NOT_FOUND');
      const data = snapshot.data() as Record<string, unknown>;
      if (action === 'claim') {
        if (data.status !== 'open' || (data.assignedTo && data.assignedTo !== principal.token.uid)) throw new AccHttpError(409, 'REPORT_CONFLICT');
        transaction.update(ref, { status: 'reviewing', assignedTo: principal.token.uid, updatedAt: FieldValue.serverTimestamp() });
      } else if (action === 'release') {
        if (data.status !== 'reviewing' || data.assignedTo !== principal.token.uid) throw new AccHttpError(409, 'REPORT_CONFLICT');
        transaction.update(ref, { status: 'open', assignedTo: null, updatedAt: FieldValue.serverTimestamp() });
      } else {
        if (!['resolved', 'dismissed'].includes(String(data.status ?? ''))) throw new AccHttpError(409, 'REPORT_CONFLICT');
        transaction.update(ref, { status: 'open', assignedTo: null, resolvedBy: null, resolvedAt: null, resolution: null, resolutionReason: null, updatedAt: FieldValue.serverTimestamp() });
      }
    });
    return Response.json({ ok: true });
  } catch (error) {
    return accErrorResponse(error);
  }
}
