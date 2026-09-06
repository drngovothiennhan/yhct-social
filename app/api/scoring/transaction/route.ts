import { FieldValue } from 'firebase-admin/firestore';
import { rootAdminDb } from '@/lib/server/firebase-admin';
import { privilegedErrorResponse, requirePrivileged, requireSameDepartment, PrivilegedHttpError } from '@/lib/server/privileged-auth';

export const runtime = 'nodejs';

type ScoreTransactionBody = {
  memberId?: unknown;
  weekNumber?: unknown;
  reason?: unknown;
  points?: unknown;
};

export async function POST(request: Request) {
  try {
    const principal = await requirePrivileged(request, 'mod');
    const body = await request.json() as ScoreTransactionBody;
    const memberId = typeof body.memberId === 'string' ? body.memberId.trim() : '';
    const weekNumber = Number(body.weekNumber);
    const points = Number(body.points);
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
    if (!memberId || !Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 53 || !Number.isFinite(points) || !reason) {
      throw new PrivilegedHttpError(400, 'INVALID_SCORE_TRANSACTION');
    }

    const db = rootAdminDb();
    const memberRef = db.collection('users').doc(memberId);
    const memberSnapshot = await memberRef.get();
    if (!memberSnapshot.exists) throw new PrivilegedHttpError(404, 'MEMBER_NOT_FOUND');
    requireSameDepartment(principal, String(memberSnapshot.data()?.department ?? ''));

    const weekRef = db.collection('scoreWeekLocks').doc(String(weekNumber));
    const txRef = db.collection('scoreTransactions').doc();
    const auditRef = db.collection('auditLogs').doc();

    await db.runTransaction(async (transaction) => {
      const [week, member] = await Promise.all([transaction.get(weekRef), transaction.get(memberRef)]);
      if (week.data()?.locked === true) throw new PrivilegedHttpError(409, 'WEEK_LOCKED');
      const currentPoints = Number(member.data()?.scoreTotal ?? 0);
      const nextPoints = currentPoints + points;
      transaction.set(txRef, {
        id: txRef.id,
        memberId,
        weekNumber,
        timestamp: FieldValue.serverTimestamp(),
        recordedBy: principal.uid,
        reason,
        points,
        reversedByTransactionId: null,
        originalTransactionId: null,
      });
      transaction.set(memberRef, { scoreTotal: nextPoints, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(auditRef, {
        action: 'score.transaction',
        actorUid: principal.uid,
        targetUid: memberId,
        entityId: txRef.id,
        createdAt: FieldValue.serverTimestamp(),
        metadata: { weekNumber, points, reason },
      });
    });

    return Response.json({ ok: true, transactionId: txRef.id });
  } catch (error) {
    return privilegedErrorResponse(error);
  }
}
