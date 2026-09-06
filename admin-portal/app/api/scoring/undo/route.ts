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
    const transactionId = cleanText(body.transactionId, 'transactionId', 256);
    const reason = cleanText(body.reason, 'reason', 500);

    const db = adminDb();
    const originalRef = db.collection('scoreTransactions').doc(transactionId);
    const reversalRef = db.collection('scoreTransactions').doc();
    const auditRef = db.collection('adminAudit').doc();

    await db.runTransaction(async (transaction) => {
      const original = await transaction.get(originalRef);
      if (!original.exists) throw new AccHttpError(404, 'SCORE_TRANSACTION_NOT_FOUND');
      const originalData = original.data() ?? {};
      if (originalData.originalTransactionId) throw new AccHttpError(409, 'CANNOT_REVERSE_REVERSAL');
      if (originalData.reversedByTransactionId) throw new AccHttpError(409, 'ALREADY_REVERSED');

      const memberId = String(originalData.memberId ?? '');
      const memberRef = db.collection('users').doc(memberId);
      const member = await transaction.get(memberRef);
      if (!member.exists) throw new AccHttpError(404, 'MEMBER_NOT_FOUND');
      assertDepartmentScope(principal.claims.role, principal.token.department, member.data()?.department);

      const weekNumber = Number(originalData.weekNumber ?? 0);
      const week = await transaction.get(db.collection('scoreWeekLocks').doc(String(weekNumber)));
      if (week.data()?.locked === true) throw new AccHttpError(409, 'WEEK_LOCKED');

      const points = Number(originalData.points ?? 0);
      const before = Number(member.data()?.scoreTotal ?? 0);
      const after = before - points;
      transaction.set(reversalRef, {
        id: reversalRef.id,
        memberId,
        weekNumber,
        timestamp: FieldValue.serverTimestamp(),
        recordedBy: principal.token.uid,
        reason,
        points: -points,
        originalTransactionId: originalRef.id,
        reversedByTransactionId: null,
      });
      transaction.update(originalRef, { reversedByTransactionId: reversalRef.id });
      transaction.set(memberRef, { scoreTotal: after, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(auditRef, {
        operationId: reversalRef.id,
        actorUid: principal.token.uid,
        actorRole: principal.claims.role,
        action: 'score.undo',
        targetType: 'member',
        targetId: memberId,
        reason,
        before: { scoreTotal: before, originalTransactionId: originalRef.id },
        after: { scoreTotal: after, reversalTransactionId: reversalRef.id, points: -points },
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return Response.json({ ok: true, transactionId: reversalRef.id });
  } catch (error) {
    return accErrorResponse(error);
  }
}
