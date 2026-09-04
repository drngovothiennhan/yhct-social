import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin.ts';
import { buildAuditEvent, type AuditRole, type AuditTargetType } from './audit.ts';

export type ModerationAction = 'keep' | 'hide' | 'soft_delete' | 'dismiss' | 'restore';
export type ModeratedContentStatus = 'active' | 'hidden' | 'deleted';

export function targetStatusForAction(action: Exclude<ModerationAction, 'restore'>): ModeratedContentStatus | null {
  if (action === 'hide') return 'hidden';
  if (action === 'soft_delete') return 'deleted';
  return null;
}

export function assertModerationTransition(input: {
  reportStatus: string;
  action: ModerationAction;
  targetStatus?: string;
  canRestore?: boolean;
}) {
  if (input.action === 'restore') {
    if (!input.canRestore) throw new Error('FORBIDDEN_RESTORE');
    if (!['hidden', 'deleted'].includes(input.targetStatus ?? '')) throw new Error('CONFLICT_RESTORE_STATE');
    return;
  }
  if (!['open', 'reviewing'].includes(input.reportStatus)) throw new Error('CONFLICT_REPORT_STATE');
}

function contentRef(report: Record<string, unknown>) {
  const postId = String(report.postId ?? '');
  if (!postId) throw new Error('TARGET_NOT_FOUND');
  if (report.targetType === 'post') return adminDb().doc(`posts/${postId}`);
  const commentId = String(report.commentId ?? '');
  if (!commentId) throw new Error('TARGET_NOT_FOUND');
  return adminDb().doc(`posts/${postId}/comments/${commentId}`);
}

export async function resolveReportTransaction(input: {
  actorUid: string;
  actorRole: AuditRole;
  operationId: string;
  reportId: string;
  action: Exclude<ModerationAction, 'restore'>;
  reason: string;
}) {
  const db = adminDb();
  const auditRef = db.doc(`adminAudit/${input.operationId}`);
  const reportRef = db.doc(`reports/${input.reportId}`);

  return db.runTransaction(async (transaction) => {
    const auditSnapshot = await transaction.get(auditRef);
    if (auditSnapshot.exists) return { replayed: true };

    const reportSnapshot = await transaction.get(reportRef);
    if (!reportSnapshot.exists) throw new Error('REPORT_NOT_FOUND');
    const report = reportSnapshot.data() as Record<string, unknown>;
    assertModerationTransition({ reportStatus: String(report.status ?? ''), action: input.action });

    const desiredStatus = targetStatusForAction(input.action);
    const targetRef = contentRef(report);
    let targetBefore: Record<string, unknown> | null = null;
    let targetAfter: Record<string, unknown> | null = null;

    if (desiredStatus) {
      const targetSnapshot = await transaction.get(targetRef);
      if (!targetSnapshot.exists) throw new Error('TARGET_NOT_FOUND');
      const target = targetSnapshot.data() as Record<string, unknown>;
      targetBefore = { status: target.status ?? null };
      targetAfter = { status: desiredStatus };
      transaction.update(targetRef, { status: desiredStatus, updatedAt: FieldValue.serverTimestamp() });
    }

    const dismissed = input.action === 'dismiss';
    const resolution = input.action === 'dismiss' ? null : input.action;
    transaction.update(reportRef, {
      status: dismissed ? 'dismissed' : 'resolved',
      resolvedBy: input.actorUid,
      resolvedAt: FieldValue.serverTimestamp(),
      resolution,
      resolutionReason: input.reason.trim(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const audit = buildAuditEvent({
      operationId: input.operationId,
      actorUid: input.actorUid,
      actorRole: input.actorRole,
      action: `moderation.${input.action}`,
      targetType: String(report.targetType) as AuditTargetType,
      targetId: report.targetType === 'post' ? String(report.postId) : `${String(report.postId)}:${String(report.commentId)}`,
      reason: input.reason,
      before: targetBefore ?? { reportStatus: report.status ?? null },
      after: targetAfter ?? { reportStatus: dismissed ? 'dismissed' : 'resolved' },
    });
    transaction.create(auditRef, { ...audit, createdAt: FieldValue.serverTimestamp() });
    return { replayed: false };
  });
}

export async function restoreContentTransaction(input: {
  actorUid: string;
  actorRole: AuditRole;
  operationId: string;
  targetType: 'post' | 'comment';
  postId: string;
  commentId?: string | null;
  reason: string;
}) {
  const db = adminDb();
  const auditRef = db.doc(`adminAudit/${input.operationId}`);
  const targetRef = input.targetType === 'post'
    ? db.doc(`posts/${input.postId}`)
    : db.doc(`posts/${input.postId}/comments/${String(input.commentId ?? '')}`);

  return db.runTransaction(async (transaction) => {
    const auditSnapshot = await transaction.get(auditRef);
    if (auditSnapshot.exists) return { replayed: true };
    const targetSnapshot = await transaction.get(targetRef);
    if (!targetSnapshot.exists) throw new Error('TARGET_NOT_FOUND');
    const target = targetSnapshot.data() as Record<string, unknown>;
    assertModerationTransition({ reportStatus: 'resolved', action: 'restore', targetStatus: String(target.status ?? ''), canRestore: true });
    transaction.update(targetRef, { status: 'active', updatedAt: FieldValue.serverTimestamp() });
    const targetId = input.targetType === 'post' ? input.postId : `${input.postId}:${String(input.commentId ?? '')}`;
    const audit = buildAuditEvent({
      operationId: input.operationId,
      actorUid: input.actorUid,
      actorRole: input.actorRole,
      action: 'moderation.restore',
      targetType: input.targetType,
      targetId,
      reason: input.reason,
      before: { status: target.status ?? null },
      after: { status: 'active' },
    });
    transaction.create(auditRef, { ...audit, createdAt: FieldValue.serverTimestamp() });
    return { replayed: false };
  });
}
