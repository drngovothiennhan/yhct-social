import { FieldValue } from 'firebase-admin/firestore';
import { AccHttpError, accErrorResponse, requireAccRole } from '@/lib/admin-auth';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

function cleanText(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new AccHttpError(400, `INVALID_${field.toUpperCase()}`);
  }
  return value.trim();
}

function assertDepartmentScope(actorRole: string, actorDepartment: unknown, memberDepartment: unknown) {
  if (actorRole !== 'mod') return;
  const department = typeof actorDepartment === 'string' ? actorDepartment.trim() : '';
  if (!department || department !== String(memberDepartment ?? '').trim()) {
    throw new AccHttpError(403, 'DEPARTMENT_SCOPE_FORBIDDEN');
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireAccRole(request, 'mod');
    const body = await request.json() as Record<string, unknown>;
    const memberId = cleanText(body.memberId, 'memberId', 128);
    const reason = cleanText(body.reason, 'reason', 500);
    const weekNumber = Number(body.weekNumber);
    const points = Number(body.points);
    if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 53 || !Number.isFinite(points) || points === 0 || Math.abs(points) > 1000) {
      throw new AccHttpError(400, 'INVALID_SCORE_TRANSACTION');
    }

    const db = adminDb();
    const memberRef = db.collection('users').doc(memberId);
    const weekRef = db.collection('scoreWeekLocks').doc(String(weekNumber));
    const transactionRef = db.collection('scoreTransactions').doc();
    const auditRef = db.collection('adminAudit').doc();

    await db.runTransaction(async (transaction) => {
      const [member, week] = await Promise.all([
        transaction.get(memberRef),
        transaction.get(weekRef),
      ]);
      if (!member.exists) throw new AccHttpError(404, 'MEMBER_NOT_FOUND');
      if (week.data()?.locked === true) throw new AccHttpError(409, 'WEEK_LOCKED');
      assertDepartmentScope(principal.claims.role, principal.token.department, member.data()?.department);

      const before = Number(member.data()?.scoreTotal ?? 0);
      const after = before + points;
      transaction.set(transactionRef, {
        id: transactionRef.id,
        memberId,
        weekNumber,
        timestamp: FieldValue.serverTimestamp(),
        recordedBy: principal.token.uid,
        reason,
        points,
        originalTransactionId: null,
        reversedByTransactionId: null,
      });
      transaction.set(memberRef, { scoreTotal: after, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(auditRef, {
        operationId: transactionRef.id,
        actorUid: principal.token.uid,
        actorRole: principal.claims.role,
        action: 'score.transaction',
        targetType: 'member',
        targetId: memberId,
        reason,
        before: { scoreTotal: before },
        after: { scoreTotal: after, weekNumber, points },
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return Response.json({ ok: true, transactionId: transactionRef.id });
  } catch (error) {
    return accErrorResponse(error);
  }
}
