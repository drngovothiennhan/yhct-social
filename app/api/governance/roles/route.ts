import { FieldValue } from 'firebase-admin/firestore';
import { rootAdminAuth, rootAdminDb } from '@/lib/server/firebase-admin';
import { normalizeClubRole, type ClubRole } from '@/lib/domain/rbac';
import { PrivilegedHttpError, privilegedErrorResponse, requirePrivileged } from '@/lib/server/privileged-auth';

export const runtime = 'nodejs';

const ASSIGNABLE_ROLES: ClubRole[] = ['member', 'mod', 'super_mod', 'admin'];

export async function POST(request: Request) {
  try {
    const principal = await requirePrivileged(request, 'admin');
    const body = await request.json() as { uid?: unknown; role?: unknown; department?: unknown; title?: unknown; reason?: unknown };
    const uid = typeof body.uid === 'string' ? body.uid.trim() : '';
    const role = normalizeClubRole(typeof body.role === 'string' ? body.role : 'member');
    const department = typeof body.department === 'string' ? body.department.trim().slice(0, 120) : '';
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
    if (!uid || !ASSIGNABLE_ROLES.includes(role) || !reason) throw new PrivilegedHttpError(400, 'INVALID_ROLE_ASSIGNMENT');
    if (uid === principal.uid && role !== 'admin') throw new PrivilegedHttpError(409, 'SELF_DEMOTION_FORBIDDEN');

    const auth = rootAdminAuth();
    const db = rootAdminDb();
    const target = await auth.getUser(uid).catch(() => null);
    if (!target) throw new PrivilegedHttpError(404, 'MEMBER_NOT_FOUND');

    const profileRef = db.collection('users').doc(uid);
    const assignmentRef = db.collection('roleAssignments').doc();
    const auditRef = db.collection('auditLogs').doc();
    const previousRole = normalizeClubRole(typeof target.customClaims?.role === 'string' ? target.customClaims.role : 'member');

    await db.runTransaction(async (transaction) => {
      const profile = await transaction.get(profileRef);
      if (!profile.exists) throw new PrivilegedHttpError(404, 'MEMBER_NOT_FOUND');
      transaction.set(profileRef, { role, department, clubTitle: title, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(assignmentRef, {
        uid,
        previousRole,
        role,
        department,
        title,
        reason,
        assignedBy: principal.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(auditRef, {
        action: 'governance.role.assign',
        actorUid: principal.uid,
        targetUid: uid,
        entityId: assignmentRef.id,
        createdAt: FieldValue.serverTimestamp(),
        metadata: { previousRole, role, department, title, reason },
      });
    });

    await auth.setCustomUserClaims(uid, {
      ...(target.customClaims ?? {}),
      role,
      department,
      clubMember: true,
    });

    return Response.json({ ok: true, assignmentId: assignmentRef.id, role, department, title });
  } catch (error) {
    return privilegedErrorResponse(error);
  }
}
