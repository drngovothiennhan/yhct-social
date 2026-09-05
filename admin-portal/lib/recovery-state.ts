import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin.ts';
import { buildAuditEvent, type AuditRole } from './audit.ts';
import {
  assertRecoveryTransition,
  validateOperationId,
  validateRecoveryMode,
  validateRecoveryReason,
  type RecoveryMode,
} from './recovery-policy.ts';

export interface RecoveryState {
  mode: RecoveryMode;
  reason: string;
  activeOperationId: string | null;
  readOnlyPublic: boolean;
  mutationBlockReason: string | null;
}

const DEFAULT_STATE: RecoveryState = {
  mode: 'normal',
  reason: '',
  activeOperationId: null,
  readOnlyPublic: false,
  mutationBlockReason: null,
};

function stateFromData(data: Record<string, unknown> | undefined): RecoveryState {
  if (!data) return DEFAULT_STATE;
  const mode = validateRecoveryMode(data.mode ?? 'normal');
  return {
    mode,
    reason: typeof data.reason === 'string' ? data.reason : '',
    activeOperationId: typeof data.activeOperationId === 'string' ? data.activeOperationId : null,
    readOnlyPublic: data.readOnlyPublic === true,
    mutationBlockReason: typeof data.mutationBlockReason === 'string' ? data.mutationBlockReason : null,
  };
}

export async function getRecoveryState(): Promise<RecoveryState> {
  const snapshot = await adminDb().doc('system/recovery').get();
  return stateFromData(snapshot.exists ? snapshot.data() as Record<string, unknown> : undefined);
}

export async function setRecoveryState(input: {
  mode: unknown;
  reason: unknown;
  operationId: unknown;
}, actor: { uid: string; role: AuditRole }) {
  const mode = validateRecoveryMode(input.mode);
  const reason = validateRecoveryReason(input.reason);
  const operationId = validateOperationId(input.operationId);
  const immutableFingerprint = JSON.stringify({ action: 'recovery.state.set', mode, reason });
  const db = adminDb();
  const stateRef = db.doc('system/recovery');
  const auditRef = db.doc(`adminAudit/${operationId}`);

  return db.runTransaction(async (transaction) => {
    const [auditSnapshot, stateSnapshot] = await Promise.all([
      transaction.get(auditRef),
      transaction.get(stateRef),
    ]);

    if (auditSnapshot.exists) {
      const recorded = auditSnapshot.data() as Record<string, unknown>;
      if (recorded.action === 'recovery.state.set' && recorded.immutableFingerprint === immutableFingerprint) {
        return { replayed: true, state: stateFromData(stateSnapshot.exists ? stateSnapshot.data() as Record<string, unknown> : undefined) };
      }
      throw new Error('RECOVERY_OPERATION_CONFLICT');
    }

    const before = stateFromData(stateSnapshot.exists ? stateSnapshot.data() as Record<string, unknown> : undefined);
    assertRecoveryTransition(before.mode, mode);
    const readOnlyPublic = mode === 'safe_mode' || mode === 'restoring';
    const after: RecoveryState = {
      mode,
      reason,
      activeOperationId: mode === 'normal' ? null : operationId,
      readOnlyPublic,
      mutationBlockReason: readOnlyPublic ? reason : null,
    };

    transaction.set(stateRef, {
      ...after,
      updatedBy: actor.uid,
      updatedAt: FieldValue.serverTimestamp(),
      lastKnownHealthyAt: mode === 'normal' ? FieldValue.serverTimestamp() : (stateSnapshot.data()?.lastKnownHealthyAt ?? null),
    }, { merge: true });

    const audit = buildAuditEvent({
      operationId,
      actorUid: actor.uid,
      actorRole: actor.role,
      action: 'recovery.state.set',
      targetType: 'recovery',
      targetId: 'system-recovery',
      reason,
      before: { mode: before.mode, readOnlyPublic: before.readOnlyPublic },
      after: { mode: after.mode, readOnlyPublic: after.readOnlyPublic },
    });
    transaction.create(auditRef, { ...audit, createdAt: FieldValue.serverTimestamp(), immutableFingerprint });
    return { replayed: false, state: after };
  });
}
