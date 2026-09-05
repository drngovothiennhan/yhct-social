import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin.ts';
import { buildAuditEvent } from './audit.ts';
import { recoveryProvider } from './recovery-provider.ts';
import { validateOperationId, validateRecoveryReason } from './recovery-policy.ts';

export type RecoveryManifestKind = 'export_checkpoint' | 'managed_backup_restore' | 'import_validation';
export type RecoveryManifestStatus = 'requested' | 'running' | 'completed' | 'failed' | 'verified' | 'rejected';

export interface CheckpointRequest {
  operationId: string;
  reason: string;
  sourceReleaseSha: string;
  collectionIds?: string[];
}

function cleanSha(value: unknown): string {
  const sha = typeof value === 'string' ? value.trim() : '';
  if (!/^[a-f0-9]{7,64}$/i.test(sha)) throw new Error('RECOVERY_RELEASE_SHA_INVALID');
  return sha;
}

function cleanCollectionIds(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 100) throw new Error('RECOVERY_COLLECTION_INVALID');
  const result = [...new Set(value.map((item) => {
    const id = typeof item === 'string' ? item.trim() : '';
    if (!id || id.length > 180 || !/^[A-Za-z0-9._-]+$/.test(id)) throw new Error('RECOVERY_COLLECTION_INVALID');
    return id;
  }))];
  return result.length ? result : undefined;
}

export function buildCheckpointRequest(input: Record<string, unknown>): CheckpointRequest {
  return {
    operationId: validateOperationId(input.operationId),
    reason: validateRecoveryReason(input.reason),
    sourceReleaseSha: cleanSha(input.sourceReleaseSha),
    ...(cleanCollectionIds(input.collectionIds) ? { collectionIds: cleanCollectionIds(input.collectionIds) } : {}),
  };
}

export function clampRecoveryLimit(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 20);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(50, Math.trunc(parsed)));
}

export function sanitizeManifest(input: Record<string, unknown>) {
  return {
    manifestId: String(input.manifestId ?? ''),
    operationId: String(input.operationId ?? ''),
    kind: String(input.kind ?? ''),
    sourceReleaseSha: String(input.sourceReleaseSha ?? ''),
    status: String(input.status ?? ''),
    requestedAt: input.requestedAt ?? null,
    failureCode: input.failureCode ?? null,
    ...(input.completedAt ? { completedAt: input.completedAt } : {}),
    ...(input.verifiedAt ? { verifiedAt: input.verifiedAt } : {}),
    ...(input.validationSummary ? { validationSummary: input.validationSummary } : {}),
  };
}

function immutableFingerprint(request: CheckpointRequest): string {
  return JSON.stringify({
    action: 'recovery.checkpoint.export',
    sourceReleaseSha: request.sourceReleaseSha,
    collectionIds: request.collectionIds ?? [],
    reason: request.reason,
  });
}

function manifestIdFor(operationId: string): string {
  return `checkpoint-${operationId}`.slice(0, 240);
}

export async function createExportCheckpoint(
  rawInput: Record<string, unknown>,
  actor: { uid: string; role: 'admin' },
) {
  const request = buildCheckpointRequest(rawInput);
  const db = adminDb();
  const manifestId = manifestIdFor(request.operationId);
  const manifestRef = db.doc(`recoveryManifests/${manifestId}`);
  const auditRef = db.doc(`adminAudit/${request.operationId}`);
  const fingerprint = immutableFingerprint(request);

  const reservation = await db.runTransaction(async (transaction) => {
    const [manifestSnapshot, auditSnapshot] = await Promise.all([
      transaction.get(manifestRef),
      transaction.get(auditRef),
    ]);
    if (manifestSnapshot.exists || auditSnapshot.exists) {
      const existing = manifestSnapshot.exists ? manifestSnapshot.data() as Record<string, unknown> : {};
      if (existing.immutableFingerprint !== fingerprint) throw new Error('RECOVERY_OPERATION_CONFLICT');
      return { replayed: true, manifest: existing };
    }

    const manifest = {
      manifestId,
      operationId: request.operationId,
      kind: 'export_checkpoint' as const,
      sourceProjectId: process.env.RECOVERY_GCP_PROJECT_ID?.trim() || 'yhct-social-260902-42a4',
      sourceDatabaseId: process.env.RECOVERY_FIRESTORE_DATABASE_ID?.trim() || '(default)',
      sourceReleaseSha: request.sourceReleaseSha,
      providerResourceRef: null,
      storagePrefix: null,
      requestedBy: actor.uid,
      requestedAt: FieldValue.serverTimestamp(),
      status: 'requested' as const,
      completedAt: null,
      verifiedBy: null,
      verifiedAt: null,
      validationSummary: null,
      failureCode: null,
      immutableFingerprint: fingerprint,
      collectionIds: request.collectionIds ?? [],
    };
    transaction.create(manifestRef, manifest);
    const audit = buildAuditEvent({
      operationId: request.operationId,
      actorUid: actor.uid,
      actorRole: actor.role,
      action: 'recovery.checkpoint.export',
      targetType: 'recovery',
      targetId: manifestId,
      reason: request.reason,
      before: null,
      after: { manifestId, status: 'requested', sourceReleaseSha: request.sourceReleaseSha },
    });
    transaction.create(auditRef, { ...audit, createdAt: FieldValue.serverTimestamp(), immutableFingerprint: fingerprint });
    return { replayed: false, manifest };
  });

  if (reservation.replayed) return { replayed: true, manifest: sanitizeManifest(reservation.manifest) };

  try {
    const provider = recoveryProvider();
    const operation = await provider.startExportCheckpoint({ checkpointId: manifestId, collectionIds: request.collectionIds });
    const providerResourceRef = operation.operationRef ?? operation.operationId;
    const storagePrefix = `${process.env.RECOVERY_EXPORT_PREFIX?.trim() || 'yhct-recovery'}/${manifestId}`;
    await manifestRef.update({
      providerResourceRef,
      storagePrefix,
      status: operation.done ? 'completed' : 'running',
      ...(operation.done ? { completedAt: FieldValue.serverTimestamp() } : {}),
    });
    const snapshot = await manifestRef.get();
    return { replayed: false, manifest: sanitizeManifest(snapshot.data() as Record<string, unknown>) };
  } catch {
    await manifestRef.update({ status: 'failed', failureCode: 'RECOVERY_PROVIDER_UNAVAILABLE' });
    throw new Error('RECOVERY_PROVIDER_UNAVAILABLE');
  }
}

export async function listRecoveryManifests(options: { limit?: unknown; cursor?: string | null } = {}) {
  const limitValue = clampRecoveryLimit(options.limit);
  let query = adminDb().collection('recoveryManifests').orderBy('requestedAt', 'desc').limit(limitValue);
  if (options.cursor) {
    const cursorSnapshot = await adminDb().doc(`recoveryManifests/${options.cursor}`).get();
    if (cursorSnapshot.exists) query = query.startAfter(cursorSnapshot);
  }
  const snapshot = await query.get();
  return {
    items: snapshot.docs.map((doc) => sanitizeManifest(doc.data() as Record<string, unknown>)),
    nextCursor: snapshot.docs.length === limitValue ? snapshot.docs.at(-1)?.id ?? null : null,
  };
}
