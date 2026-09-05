'use client';

import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { buildReportId, validateReportDraft, type ReportTargetType } from '@/lib/domain/report';

export async function createReport(input: {
  targetType: ReportTargetType;
  postId: string;
  commentId?: string | null;
  reasonCode: string;
  details?: string;
}): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Bạn cần đăng nhập để báo cáo nội dung.');

  const validated = validateReportDraft({ reasonCode: input.reasonCode, details: input.details ?? '' });
  const reportId = buildReportId({
    reporterUid: user.uid,
    targetType: input.targetType,
    postId: input.postId,
    commentId: input.commentId ?? null,
  });
  const ref = doc(db, 'reports', reportId);

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists()) throw new Error('already-exists');
    transaction.set(ref, {
      reporterUid: user.uid,
      targetType: input.targetType,
      postId: input.postId,
      commentId: input.targetType === 'comment' ? input.commentId ?? null : null,
      reasonCode: validated.reasonCode,
      details: validated.details,
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      assignedTo: null,
      resolvedBy: null,
      resolvedAt: null,
      resolution: null,
      resolutionReason: null,
    });
  });

  return reportId;
}
