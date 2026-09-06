import { FieldValue } from 'firebase-admin/firestore';
import { rootAdminDb } from '@/lib/server/firebase-admin';
import { PrivilegedHttpError, privilegedErrorResponse, requirePrivileged } from '@/lib/server/privileged-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const principal = await requirePrivileged(request, 'admin');
    const body = await request.json() as { memberId?: unknown; title?: unknown; reason?: unknown; sourcePostIds?: unknown; sourceScore?: unknown; activityCount?: unknown };
    const memberId = typeof body.memberId === 'string' ? body.memberId.trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 160) : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : '';
    const sourcePostIds = Array.isArray(body.sourcePostIds) ? body.sourcePostIds.filter((v): v is string => typeof v === 'string').slice(0, 20) : [];
    const sourceScore = Number(body.sourceScore ?? 0);
    const activityCount = Number(body.activityCount ?? 0);
    if (!memberId || !title || !reason || !Number.isFinite(sourceScore) || !Number.isFinite(activityCount)) {
      throw new PrivilegedHttpError(400, 'INVALID_RECOGNITION');
    }

    const db = rootAdminDb();
    const memberRef = db.collection('users').doc(memberId);
    const recognitionRef = db.collection('recognitions').doc();
    const auditRef = db.collection('auditLogs').doc();

    await db.runTransaction(async (transaction) => {
      const member = await transaction.get(memberRef);
      if (!member.exists) throw new PrivilegedHttpError(404, 'MEMBER_NOT_FOUND');
      transaction.set(recognitionRef, {
        memberId,
        title,
        reason,
        sourcePostIds,
        sourceScore,
        activityCount,
        status: 'approved',
        approvedBy: principal.uid,
        approvedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(auditRef, {
        action: 'recognition.approve',
        actorUid: principal.uid,
        targetUid: memberId,
        entityId: recognitionRef.id,
        createdAt: FieldValue.serverTimestamp(),
        metadata: { title, sourcePostIds, sourceScore, activityCount, reason },
      });
    });

    return Response.json({ ok: true, recognitionId: recognitionRef.id });
  } catch (error) {
    return privilegedErrorResponse(error);
  }
}
