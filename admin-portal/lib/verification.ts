import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin.ts';
import { buildAuditEvent } from './audit.ts';

export type VerificationDecision = 'verified' | 'rejected';
export type VerificationWorkflowStatus = 'unsubmitted' | 'pending' | 'verified' | 'rejected';

export function normalizeVerificationStatus(value: unknown): VerificationWorkflowStatus {
  if (value === 'pending' || value === 'verified' || value === 'rejected') return value;
  return 'unsubmitted';
}

export function assertVerificationDecision(input: {
  currentStatus: unknown;
  decision: unknown;
  reason: string;
}) {
  if (normalizeVerificationStatus(input.currentStatus) !== 'pending') {
    throw new Error('CONFLICT_VERIFICATION_STATE');
  }
  if (input.decision !== 'verified' && input.decision !== 'rejected') {
    throw new Error('INVALID_VERIFICATION_DECISION');
  }
  if (input.decision === 'rejected' && !input.reason.trim()) {
    throw new Error('REJECTION_REASON_REQUIRED');
  }
}

export async function decideVerificationTransaction(input: {
  actorUid: string;
  actorRole: 'super_mod' | 'admin';
  operationId: string;
  uid: string;
  decision: VerificationDecision;
  reason: string;
}) {
  const db = adminDb();
  const auditRef = db.doc(`adminAudit/${input.operationId}`);
  const requestRef = db.doc(`verificationRequests/${input.uid}`);
  const userRef = db.doc(`users/${input.uid}`);

  return db.runTransaction(async (transaction) => {
    const auditSnapshot = await transaction.get(auditRef);
    if (auditSnapshot.exists) return { replayed: true };

    const [requestSnapshot, userSnapshot] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(userRef),
    ]);
    if (!requestSnapshot.exists || !userSnapshot.exists) throw new Error('VERIFICATION_REQUEST_NOT_FOUND');

    const request = requestSnapshot.data() as Record<string, unknown>;
    const profile = userSnapshot.data() as Record<string, unknown>;
    if (profile.accountType !== 'practitioner') throw new Error('VERIFICATION_PROFILE_INVALID');

    assertVerificationDecision({
      currentStatus: request.status,
      decision: input.decision,
      reason: input.reason,
    });

    const decisionReason = input.reason.trim();
    transaction.update(requestRef, {
      status: input.decision,
      decisionBy: input.actorUid,
      decisionAt: FieldValue.serverTimestamp(),
      decisionReason,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(userRef, {
      verificationStatus: input.decision,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const auditReason = decisionReason || 'Hồ sơ chuyên môn đạt điều kiện xác minh.';
    const audit = buildAuditEvent({
      operationId: input.operationId,
      actorUid: input.actorUid,
      actorRole: input.actorRole,
      action: `verification.${input.decision}`,
      targetType: 'verification',
      targetId: input.uid,
      reason: auditReason,
      before: {
        requestStatus: request.status ?? null,
        profileStatus: profile.verificationStatus ?? null,
      },
      after: {
        requestStatus: input.decision,
        profileStatus: input.decision,
      },
    });
    transaction.create(auditRef, { ...audit, createdAt: FieldValue.serverTimestamp() });

    return { replayed: false, status: input.decision };
  });
}
