import { FieldValue } from 'firebase-admin/firestore';
import { rootAdminDb } from '@/lib/server/firebase-admin';
import { PrivilegedHttpError, privilegedErrorResponse, requirePrivileged, requireSameDepartment } from '@/lib/server/privileged-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const principal = await requirePrivileged(request, 'mod');
    const body = await request.json() as { transactionId?: unknown; reason?: unknown };
    const transactionId = typeof body.transactionId === 'string' ? body.transactionId.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
    if (!transactionId || !reason) throw new PrivilegedHttpError(400, 'INVALID_UNDO_REQUEST');

    const db = rootAdminDb();
    const originalRef = db.collection('scoreTransactions').doc(transactionId);
    const undoRef = db.collection('scoreTransactions').doc();
    const auditRef = db.collection('auditLogs').doc();

    await db.runTransaction(async (transaction) => {
      const original = await transaction.get(originalRef);
      if (!original.exists) throw new PrivilegedHttpError(404, 'SCORE_TRANSACTION_NOT_FOUND');
      const data = original.data() ?? {};
      if (data.originalTransactionId) throw new PrivilegedHttpError(409, 'CANNOT_UNDO_REVERSAL');
      if (data.reversedByTransactionId) throw new PrivilegedHttpError(409, 'ALREADY_REVERSED');

      const memberId = String(data.memberId ?? '');
      const memberRef = db.collection('users').doc(memberId);
      const member = await transaction.get(memberRef);
      if (!member.exists) throw new PrivilegedHttpError(404, 'MEMBER_NOT_FOUND');
      requireSameDepartment(principal, String(member.data()?.department ?? ''));

      const weekNumber = Number(data.weekNumber ?? 0);
      const weekRef = db.collection('scoreWeekLocks').doc(String(weekNumber));
      const week = await transaction.get(weekRef);
      if (week.data()?.locked === true) throw new PrivilegedHttpError(409, 'WEEK_LOCKED');

      const points = Number(data.points ?? 0);
      const currentPoints = Number(member.data()?.scoreTotal ?? 0);
      transaction.set(undoRef, {
        id: undoRef.id,
        memberId,
        weekNumber,
        timestamp: FieldValue.serverTimestamp(),
        recordedBy: principal.uid,
        reason,
        points: -points,
        originalTransactionId: originalRef.id,
        reversedByTransactionId: null,
      });
      transaction.update(originalRef, { reversedByTransactionId: undoRef.id });
      transaction.set(memberRef, { scoreTotal: currentPoints - points, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(auditRef, {
        action: 'score.undo',
        actorUid: principal.uid,
        targetUid: memberId,
        entityId: undoRef.id,
        createdAt: FieldValue.serverTimestamp(),
        metadata: { originalTransactionId: originalRef.id, points: -points, reason },
      });
    });

    return Response.json({ ok: true, transactionId: undoRef.id });
  } catch (error) {
    return privilegedErrorResponse(error);
  }
}
