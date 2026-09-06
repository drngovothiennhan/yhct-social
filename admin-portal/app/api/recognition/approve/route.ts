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

export async function POST(request: Request) {
  try {
    const principal = await requireAccRole(request, 'admin');
    const body = await request.json() as Record<string, unknown>;
    const memberId = cleanText(body.memberId, 'memberId', 128);
    const title = cleanText(body.title, 'title', 160);
    const reason = cleanText(body.reason, 'reason', 1000);
    const sourcePostIds = Array.isArray(body.sourcePostIds)
      ? body.sourcePostIds.filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).map((value) => value.trim()).slice(0, 20)
      : [];
    const sourceScore = Number(body.sourceScore ?? 0);
    const activityCount = Number(body.activityCount ?? 0);
    if (!Number.isFinite(sourceScore) || !Number.isInteger(activityCount) || activityCount < 0) {
      throw new AccHttpError(400, 'INVALID_RECOGNITION_EVIDENCE');
    }

    const db = adminDb();
    const memberRef = db.collection('users').doc(memberId);
    const recognitionRef = db.collection('recognitions').doc();
    const auditRef = db.collection('adminAudit').doc();

    await db.runTransaction(async (transaction) => {
      const member = await transaction.get(memberRef);
      if (!member.exists) throw new AccHttpError(404, 'MEMBER_NOT_FOUND');
      transaction.set(recognitionRef, {
        memberId,
        title,
        reason,
        sourcePostIds,
        sourceScore,
        activityCount,
        status: 'approved',
        approvedBy: principal.token.uid,
        approvedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(auditRef, {
        operationId: recognitionRef.id,
        actorUid: principal.token.uid,
        actorRole: principal.claims.role,
        action: 'recognition.approve',
        targetType: 'member',
        targetId: memberId,
        reason,
        before: null,
        after: { recognitionId: recognitionRef.id, title, sourcePostIds, sourceScore, activityCount },
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return Response.json({ ok: true, recognitionId: recognitionRef.id });
  } catch (error) {
    return accErrorResponse(error);
  }
}
