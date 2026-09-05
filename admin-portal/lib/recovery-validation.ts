import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getAdminApp, adminDb } from './firebase-admin.ts';
import { buildAuditEvent } from './audit.ts';
import { validateOperationId, validateRecoveryReason } from './recovery-policy.ts';

export interface RecoveryValidationSummary {
  databaseReachable: boolean;
  schemaCompatible: boolean;
  criticalCollections: Record<string, 'present' | 'missing' | 'unknown'>;
  sampleChecksPassed: number;
  sampleChecksFailed: number;
  warnings: string[];
  validatedAt: unknown;
}

function warning(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : 'RECOVERY_VALIDATION_WARNING';
  return normalized.slice(0, 160);
}

export function sanitizeValidationSummary(input: Record<string, unknown>): RecoveryValidationSummary {
  const criticalInput = input.criticalCollections && typeof input.criticalCollections === 'object'
    ? input.criticalCollections as Record<string, unknown>
    : {};
  const criticalCollections = Object.fromEntries(
    Object.entries(criticalInput).slice(0, 12).map(([key, value]) => [
      key.slice(0, 80),
      value === 'present' || value === 'missing' ? value : 'unknown',
    ]),
  ) as Record<string, 'present' | 'missing' | 'unknown'>;
  const warnings = Array.isArray(input.warnings) ? input.warnings.slice(0, 20).map(warning) : [];
  return {
    databaseReachable: input.databaseReachable === true,
    schemaCompatible: input.schemaCompatible === true,
    criticalCollections,
    sampleChecksPassed: Math.max(0, Math.min(100, Number(input.sampleChecksPassed) || 0)),
    sampleChecksFailed: Math.max(0, Math.min(100, Number(input.sampleChecksFailed) || 0)),
    warnings,
    validatedAt: input.validatedAt ?? new Date().toISOString(),
  };
}

function validRecoveryId(value: unknown): string {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!/^recovery-[a-z0-9-]+$/.test(id) || id.length > 63) throw new Error('RECOVERY_TARGET_INVALID');
  return id;
}

const CRITICAL_COLLECTIONS = ['users', 'posts', 'system'] as const;

export async function validateRecoveryCandidate(manifestIdValue: string) {
  const manifestId = manifestIdValue.trim();
  if (!manifestId || manifestId.includes('/') || manifestId.length > 240) throw new Error('RECOVERY_MANIFEST_NOT_READY');
  const manifestRef = adminDb().doc(`recoveryManifests/${manifestId}`);
  const manifestSnapshot = await manifestRef.get();
  if (!manifestSnapshot.exists) throw new Error('RECOVERY_MANIFEST_NOT_READY');
  const manifest = manifestSnapshot.data() as Record<string, unknown>;
  if (!['completed', 'running'].includes(String(manifest.status ?? ''))) throw new Error('RECOVERY_MANIFEST_NOT_READY');
  const recoveryDatabaseId = validRecoveryId(manifest.recoveryDatabaseId);
  const recoveryDb = getFirestore(getAdminApp(), recoveryDatabaseId);

  let databaseReachable = true;
  let collectionRows: Array<[string, 'present' | 'missing' | 'unknown']> = [];
  try {
    const snapshots = await Promise.all(CRITICAL_COLLECTIONS.map((name) => recoveryDb.collection(name).limit(1).get()));
    collectionRows = CRITICAL_COLLECTIONS.map((name, index) => [name, snapshots[index]?.empty ? 'missing' : 'present']);
  } catch {
    databaseReachable = false;
    collectionRows = CRITICAL_COLLECTIONS.map((name) => [name, 'unknown']);
  }

  let schemaCompatible = databaseReachable;
  const warnings: string[] = [];
  if (databaseReachable) {
    try {
      const schemaSnapshot = await recoveryDb.doc('system/schema').get();
      const required = process.env.RECOVERY_SCHEMA_VERSION?.trim();
      const actual = schemaSnapshot.exists ? String(schemaSnapshot.data()?.version ?? '') : '';
      if (required && actual !== required) {
        schemaCompatible = false;
        warnings.push('SCHEMA_VERSION_MISMATCH');
      } else if (!schemaSnapshot.exists) {
        warnings.push('SCHEMA_MARKER_MISSING');
      }
    } catch {
      schemaCompatible = false;
      warnings.push('SCHEMA_MARKER_UNREADABLE');
    }
  }

  const criticalCollections = Object.fromEntries(collectionRows);
  const passed = collectionRows.filter(([, state]) => state === 'present').length + (schemaCompatible ? 1 : 0);
  const failed = collectionRows.filter(([, state]) => state === 'missing').length + (schemaCompatible ? 0 : 1);
  const summary = sanitizeValidationSummary({
    databaseReachable,
    schemaCompatible,
    criticalCollections,
    sampleChecksPassed: passed,
    sampleChecksFailed: failed,
    warnings,
    validatedAt: new Date().toISOString(),
  });
  await manifestRef.update({ validationSummary: summary, status: schemaCompatible && databaseReachable ? 'completed' : 'failed' });
  return summary;
}

export async function decideRecoveryManifest(input: {
  manifestId: string;
  decision: 'verified' | 'rejected';
  operationId: unknown;
  reason: unknown;
}, actor: { uid: string; role: 'admin' }) {
  const operationId = validateOperationId(input.operationId);
  const reason = validateRecoveryReason(input.reason);
  const manifestId = input.manifestId.trim();
  if (!manifestId || manifestId.includes('/') || manifestId.length > 240) throw new Error('RECOVERY_MANIFEST_NOT_READY');
  if (!['verified', 'rejected'].includes(input.decision)) throw new Error('RECOVERY_VALIDATION_FAILED');
  const db = adminDb();
  const manifestRef = db.doc(`recoveryManifests/${manifestId}`);
  const auditRef = db.doc(`adminAudit/${operationId}`);
  return db.runTransaction(async (transaction) => {
    const [manifestSnapshot, auditSnapshot] = await Promise.all([transaction.get(manifestRef), transaction.get(auditRef)]);
    if (!manifestSnapshot.exists) throw new Error('RECOVERY_MANIFEST_NOT_READY');
    const manifest = manifestSnapshot.data() as Record<string, unknown>;
    if (auditSnapshot.exists) {
      const audit = auditSnapshot.data() as Record<string, unknown>;
      if (audit.action === `recovery.manifest.${input.decision}` && audit.targetId === manifestId) return { replayed: true };
      throw new Error('RECOVERY_OPERATION_CONFLICT');
    }
    if (!manifest.validationSummary || !['completed', 'failed'].includes(String(manifest.status ?? ''))) throw new Error('RECOVERY_VALIDATION_FAILED');
    transaction.update(manifestRef, {
      status: input.decision,
      verifiedBy: actor.uid,
      verifiedAt: FieldValue.serverTimestamp(),
      decisionReason: reason,
    });
    const audit = buildAuditEvent({
      operationId,
      actorUid: actor.uid,
      actorRole: actor.role,
      action: `recovery.manifest.${input.decision}`,
      targetType: 'recovery',
      targetId: manifestId,
      reason,
      before: { status: manifest.status ?? null },
      after: { status: input.decision },
    });
    transaction.create(auditRef, { ...audit, createdAt: FieldValue.serverTimestamp() });
    return { replayed: false };
  });
}
