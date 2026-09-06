import { FieldValue } from 'firebase-admin/firestore';
import { rootAdminAuth, rootAdminDb } from '@/lib/server/firebase-admin';

export const runtime = 'nodejs';

class RegistrationHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function requireMember(request: Request) {
  const header = request.headers.get('authorization')?.trim() ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match?.[1]) throw new RegistrationHttpError(401, 'UNAUTHORIZED');
  const decoded = await rootAdminAuth().verifyIdToken(match[1], true).catch(() => null);
  if (!decoded) throw new RegistrationHttpError(401, 'UNAUTHORIZED');
  if (decoded.clubMember !== true || decoded.mustChangePassword === true) {
    throw new RegistrationHttpError(403, 'FORBIDDEN');
  }
  return decoded;
}

export async function POST(request: Request) {
  try {
    const actor = await requireMember(request);
    const body = await request.json() as { activityId?: unknown; action?: unknown };
    const activityId = typeof body.activityId === 'string' ? body.activityId.trim() : '';
    const action = body.action === 'cancel' ? 'cancel' : 'register';
    if (!activityId) throw new RegistrationHttpError(400, 'ACTIVITY_REQUIRED');

    const db = rootAdminDb();
    const activityRef = db.collection('activities').doc(activityId);
    const registrationRef = activityRef.collection('registrations').doc(actor.uid);
    const auditRef = db.collection('auditLogs').doc();

    const result = await db.runTransaction(async (transaction) => {
      const [activity, existing] = await Promise.all([
        transaction.get(activityRef),
        transaction.get(registrationRef),
      ]);
      if (!activity.exists || activity.data()?.status !== 'published') {
        throw new RegistrationHttpError(404, 'ACTIVITY_NOT_AVAILABLE');
      }

      const activityData = activity.data() ?? {};
      const registeredCount = Number(activityData.registeredCount ?? 0);
      const waitlistCount = Number(activityData.waitlistCount ?? 0);
      const capacity = Math.max(0, Number(activityData.capacity ?? 0));
      const currentStatus = String(existing.data()?.status ?? '');

      if (action === 'cancel') {
        if (!existing.exists || currentStatus === 'cancelled') return { status: 'cancelled' as const };
        transaction.set(registrationRef, {
          uid: actor.uid,
          activityId,
          status: 'cancelled',
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        if (currentStatus === 'registered') {
          transaction.set(activityRef, { registeredCount: Math.max(0, registeredCount - 1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        } else if (currentStatus === 'waitlisted') {
          transaction.set(activityRef, { waitlistCount: Math.max(0, waitlistCount - 1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        }
        transaction.set(auditRef, {
          action: 'activity.registration.cancel', actorUid: actor.uid, targetUid: actor.uid,
          entityId: activityId, createdAt: FieldValue.serverTimestamp(), metadata: { previousStatus: currentStatus },
        });
        return { status: 'cancelled' as const };
      }

      if (existing.exists && currentStatus !== 'cancelled') {
        return { status: currentStatus === 'waitlisted' ? 'waitlisted' as const : 'registered' as const };
      }

      const status = capacity > 0 && registeredCount >= capacity ? 'waitlisted' as const : 'registered' as const;
      transaction.set(registrationRef, {
        uid: actor.uid,
        activityId,
        status,
        registeredAt: existing.exists ? (existing.data()?.registeredAt ?? FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(activityRef, status === 'registered'
        ? { registeredCount: registeredCount + 1, updatedAt: FieldValue.serverTimestamp() }
        : { waitlistCount: waitlistCount + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(auditRef, {
        action: 'activity.registration.create', actorUid: actor.uid, targetUid: actor.uid,
        entityId: activityId, createdAt: FieldValue.serverTimestamp(), metadata: { status },
      });
      return { status };
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof RegistrationHttpError) return Response.json({ error: error.message }, { status: error.status });
    console.error('ACTIVITY_REGISTRATION_ERROR', error instanceof Error ? error.name : 'unknown');
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
