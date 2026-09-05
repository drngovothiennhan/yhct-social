import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin.ts';
import { buildAuditEvent } from './audit.ts';
import { recoveryProvider } from './recovery-provider.ts';
import { sanitizeManifest } from './recovery-manifests.ts';
import { validateOperationId, validateRecoveryReason } from './recovery-policy.ts';

function safeId(value: unknown, code: string): string {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id || id.length > 180 || !/^[A-Za-z0-9._-]+$/.test(id)) throw new Error(code);
  return id;
}

function safeSha(value: unknown): string {
  const sha = typeof value === 'string' ? value.trim() : '';
  if (!/^[a-f0-9]{7,64}$/i.test(sha)) throw new Error('RECOVERY_RELEASE_SHA_INVALID');
  return sha;
}

export function deriveRecoveryDatabaseId(operationIdValue: string, now = new Date()): string {
  const operationId = validateOperationId(operationIdValue).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const min = String(now.getUTCMinutes()).padStart(2, '0');
  const short = operationId.replace(/^-|-$/g, '').slice(0, 20) || 'operation';
  return `recovery-${yyyy}${mm}${dd}-${hh}${min}-${short}`.slice(0, 63);
}

export function assertRecoveryTarget(databaseId: string, liveDatabaseId: string): void {
  const target = databaseId.trim();
  const live = liveDatabaseId.trim();
  if (!target.startsWith('recovery-') || target === '(default)' || target === live || target.length > 63 || !/^[a-z][a-z0-9-]+$/.test(target)) {
    throw new Error('RECOVERY_TARGET_INVALID');
  }
}

function fingerprint(input: Record<string, unknown>): string {
  return JSON.stringify(input);
}

async function reserveOperation(input: {
  operationId: string;
  manifestId: string;
  kind: 'managed_backup_restore' | 'import_validation';
  sourceReleaseSha: string;
  actorUid: string;
  reason: string;
  action: string;
  fingerprint: string;
  extra: Record<string, unknown>;
}) {
  const db = adminDb();
  const manifestRef = db.doc(`recoveryManifests/${input.manifestId}`);
  const auditRef = db.doc(`adminAudit/${input.operationId}`);
  return db.runTransaction(async (transaction) => {
    const [manifestSnapshot, auditSnapshot] = await Promise.all([transaction.get(manifestRef), transaction.get(auditRef)]);
    if (manifestSnapshot.exists || auditSnapshot.exists) {
      const existing = manifestSnapshot.exists ? manifestSnapshot.data() as Record<string, unknown> : {};
      if (existing.immutableFingerprint !== input.fingerprint) throw new Error('RECOVERY_OPERATION_CONFLICT');
      return { replayed: true, manifest: existing };
    }
    const manifest = {
      manifestId: input.manifestId,
      operationId: input.operationId,
      kind: input.kind,
      sourceProjectId: process.env.RECOVERY_GCP_PROJECT_ID?.trim() || 'yhct-social-260902-42a4',
      sourceDatabaseId: process.env.RECOVERY_FIRESTORE_DATABASE_ID?.trim() || '(default)',
      sourceReleaseSha: input.sourceReleaseSha,
      providerResourceRef: null,
      storagePrefix: null,
      requestedBy: input.actorUid,
      requestedAt: FieldValue.serverTimestamp(),
      status: 'requested',
      completedAt: null,
      verifiedBy: null,
      verifiedAt: null,
      validationSummary: null,
      failureCode: null,
      immutableFingerprint: input.fingerprint,
      ...input.extra,
    };
    transaction.create(manifestRef, manifest);
    const audit = buildAuditEvent({
      operationId: input.operationId,
      actorUid: input.actorUid,
      actorRole: 'admin',
      action: input.action,
      targetType: 'recovery',
      targetId: input.manifestId,
      reason: input.reason,
      before: null,
      after: { manifestId: input.manifestId, status: 'requested' },
    });
    transaction.create(auditRef, { ...audit, createdAt: FieldValue.serverTimestamp(), immutableFingerprint: input.fingerprint });
    return { replayed: false, manifest };
  });
}

export async function startRestoreToRecoveryDatabase(raw: Record<string, unknown>, actor: { uid: string; role: 'admin' }) {
  const operationId = validateOperationId(raw.operationId);
  const reason = validateRecoveryReason(raw.reason);
  const backupId = safeId(raw.backupId, 'RECOVERY_BACKUP_NOT_FOUND');
  const sourceReleaseSha = safeSha(raw.sourceReleaseSha);
  const liveDatabaseId = process.env.RECOVERY_FIRESTORE_DATABASE_ID?.trim() || '(default)';
  const recoveryDatabaseId = deriveRecoveryDatabaseId(operationId);
  assertRecoveryTarget(recoveryDatabaseId, liveDatabaseId);
  const manifestId = `restore-${operationId}`.slice(0, 240);
  const immutable = fingerprint({ action: 'restore', backupId, sourceReleaseSha, recoveryDatabaseId });
  const reservation = await reserveOperation({
    operationId, manifestId, kind: 'managed_backup_restore', sourceReleaseSha,
    actorUid: actor.uid, reason, action: 'recovery.restore.prepare', fingerprint: immutable,
    extra: { backupId, recoveryDatabaseId },
  });
  if (reservation.replayed) return { replayed: true, manifest: sanitizeManifest(reservation.manifest) };

  const ref = adminDb().doc(`recoveryManifests/${manifestId}`);
  try {
    const operation = await recoveryProvider().startManagedBackupRestore({ backupId, recoveryDatabaseId });
    await ref.update({
      providerResourceRef: operation.operationRef ?? operation.operationId,
      status: operation.done ? 'completed' : 'running',
      ...(operation.done ? { completedAt: FieldValue.serverTimestamp() } : {}),
    });
    const snapshot = await ref.get();
    return { replayed: false, manifest: sanitizeManifest(snapshot.data() as Record<string, unknown>), recoveryDatabaseId };
  } catch {
    await ref.update({ status: 'failed', failureCode: 'RECOVERY_PROVIDER_UNAVAILABLE' });
    throw new Error('RECOVERY_PROVIDER_UNAVAILABLE');
  }
}

export async function startImportFromCheckpoint(raw: Record<string, unknown>, actor: { uid: string; role: 'admin' }) {
  const operationId = validateOperationId(raw.operationId);
  const reason = validateRecoveryReason(raw.reason);
  const sourceManifestId = safeId(raw.manifestId, 'RECOVERY_CHECKPOINT_INVALID');
  const sourceRef = adminDb().doc(`recoveryManifests/${sourceManifestId}`);
  const sourceSnapshot = await sourceRef.get();
  if (!sourceSnapshot.exists) throw new Error('RECOVERY_CHECKPOINT_INVALID');
  const source = sourceSnapshot.data() as Record<string, unknown>;
  if (!['completed', 'verified'].includes(String(source.status ?? '')) || source.kind !== 'export_checkpoint') throw new Error('RECOVERY_MANIFEST_NOT_READY');
  const storagePrefix = typeof source.storagePrefix === 'string' ? source.storagePrefix : '';
  if (!storagePrefix.startsWith('gs://')) throw new Error('RECOVERY_CHECKPOINT_INVALID');
  const sourceReleaseSha = safeSha(source.sourceReleaseSha);
  const liveDatabaseId = process.env.RECOVERY_FIRESTORE_DATABASE_ID?.trim() || '(default)';
  const recoveryDatabaseId = deriveRecoveryDatabaseId(operationId);
  assertRecoveryTarget(recoveryDatabaseId, liveDatabaseId);
  const manifestId = `import-${operationId}`.slice(0, 240);
  const immutable = fingerprint({ action: 'import', sourceManifestId, sourceReleaseSha, recoveryDatabaseId });
  const reservation = await reserveOperation({
    operationId, manifestId, kind: 'import_validation', sourceReleaseSha,
    actorUid: actor.uid, reason, action: 'recovery.import.prepare', fingerprint: immutable,
    extra: { sourceManifestId, recoveryDatabaseId },
  });
  if (reservation.replayed) return { replayed: true, manifest: sanitizeManifest(reservation.manifest) };

  const ref = adminDb().doc(`recoveryManifests/${manifestId}`);
  try {
    const collectionIds = Array.isArray(source.collectionIds) ? source.collectionIds.filter((item): item is string => typeof item === 'string') : undefined;
    const operation = await recoveryProvider().startImportToRecoveryDatabase({ recoveryDatabaseId, inputUriPrefix: storagePrefix, collectionIds });
    await ref.update({
      providerResourceRef: operation.operationRef ?? operation.operationId,
      status: operation.done ? 'completed' : 'running',
      ...(operation.done ? { completedAt: FieldValue.serverTimestamp() } : {}),
    });
    const snapshot = await ref.get();
    return { replayed: false, manifest: sanitizeManifest(snapshot.data() as Record<string, unknown>), recoveryDatabaseId };
  } catch {
    await ref.update({ status: 'failed', failureCode: 'RECOVERY_PROVIDER_UNAVAILABLE' });
    throw new Error('RECOVERY_PROVIDER_UNAVAILABLE');
  }
}
