import { FieldValue } from 'firebase-admin/firestore';
import { AccHttpError, accErrorResponse, requireAccRole } from '@/lib/admin-auth';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import {
  canDisableAccount,
  canEditClubTitle,
  canManageVerification,
  canSetRole,
  normalizeAccRole,
  type AccRole,
} from '@/lib/rbac';

export const runtime = 'nodejs';

type MemberAction =
  | { action: 'role'; role: AccRole }
  | { action: 'title'; title: string }
  | { action: 'disabled'; disabled: boolean; reason?: string }
  | { action: 'verification'; status: 'pending' | 'verified' | 'rejected' };

async function assertNotFinalActiveAdmin(uid: string, targetRole: AccRole, destructive: boolean) {
  if (!destructive || targetRole !== 'admin') return;
  const admins = await adminDb().collection('users').where('role', '==', 'admin').get();
  let activeAdmins = 0;
  for (const doc of admins.docs) {
    const account = await adminAuth().getUser(doc.id).catch(() => null);
    if (account && !account.disabled) activeAdmins += 1;
  }
  const target = await adminAuth().getUser(uid).catch(() => null);
  if (target && !target.disabled && activeAdmins <= 1) {
    throw new AccHttpError(409, 'FINAL_ACTIVE_ADMIN_PROTECTED');
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ uid: string }> },
) {
  try {
    const principal = await requireAccRole(request, 'mod');
    const { uid } = await context.params;
    const body = await request.json() as MemberAction;
    const targetUser = await adminAuth().getUser(uid);
    const targetProfile = await adminDb().collection('users').doc(uid).get();
    if (!targetProfile.exists) throw new AccHttpError(404, 'MEMBER_NOT_FOUND');
    const targetData = targetProfile.data() ?? {};
    const targetRole = normalizeAccRole(targetUser.customClaims?.role ?? targetData.role);
    const actorRole = principal.claims.role;

    if (body.action === 'role') {
      if (!canSetRole(actorRole, targetRole, body.role)) throw new AccHttpError(403, 'ROLE_CHANGE_FORBIDDEN');
      await assertNotFinalActiveAdmin(uid, targetRole, body.role !== 'admin');
      await adminAuth().setCustomUserClaims(uid, {
        ...(targetUser.customClaims ?? {}),
        role: body.role,
        clubMember: true,
      });
      await targetProfile.ref.update({ role: body.role, updatedAt: FieldValue.serverTimestamp() });
      return Response.json({ ok: true, role: body.role });
    }

    if (body.action === 'title') {
      const title = body.title.trim();
      if (title.length > 120) throw new AccHttpError(400, 'TITLE_TOO_LONG');
      if (!canEditClubTitle(actorRole, targetRole)) throw new AccHttpError(403, 'TITLE_CHANGE_FORBIDDEN');
      await targetProfile.ref.update({
        clubTitle: title,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return Response.json({ ok: true, clubTitle: title });
    }

    if (body.action === 'disabled') {
      if (!canDisableAccount(actorRole, targetRole)) throw new AccHttpError(403, 'ACCOUNT_STATUS_FORBIDDEN');
      await assertNotFinalActiveAdmin(uid, targetRole, body.disabled);
      await adminAuth().updateUser(uid, { disabled: body.disabled });
      await targetProfile.ref.update({
        accountStatus: body.disabled ? 'disabled' : 'active',
        updatedAt: FieldValue.serverTimestamp(),
      });
      await targetProfile.ref.collection('private').doc('access').set({
        disabled: body.disabled,
        disabledReason: body.disabled ? String(body.reason ?? '').slice(0, 240) : '',
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return Response.json({ ok: true, disabled: body.disabled });
    }

    if (body.action === 'verification') {
      if (!canManageVerification(actorRole)) throw new AccHttpError(403, 'VERIFICATION_FORBIDDEN');
      if (!['pending', 'verified', 'rejected'].includes(body.status)) throw new AccHttpError(400, 'INVALID_VERIFICATION_STATUS');
      await targetProfile.ref.update({
        verificationStatus: body.status,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return Response.json({ ok: true, verificationStatus: body.status });
    }

    throw new AccHttpError(400, 'INVALID_ACTION');
  } catch (error) {
    return accErrorResponse(error);
  }
}
