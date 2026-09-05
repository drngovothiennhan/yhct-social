export const REPORT_REASON_CODES = [
  'spam',
  'misinformation',
  'inappropriate',
  'privacy',
  'other',
] as const;

export type ReportReasonCode = (typeof REPORT_REASON_CODES)[number];
export type ReportTargetType = 'post' | 'comment';

export interface ReportIdentity {
  reporterUid: string;
  targetType: ReportTargetType;
  postId: string;
  commentId: string | null;
}

export interface ReportDraft {
  reasonCode: string;
  details: string;
}

function requireId(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required.`);
  if (normalized.includes('/')) throw new Error(`${field} is invalid.`);
  return normalized;
}

export function buildReportId(input: ReportIdentity): string {
  const reporterUid = requireId(input.reporterUid, 'reporterUid');
  const postId = requireId(input.postId, 'postId');
  if (input.targetType === 'post') return `post__${postId}__${reporterUid}`;
  if (input.targetType !== 'comment') throw new Error('targetType is invalid.');
  if (!input.commentId) throw new Error('commentId is required for comment reports.');
  const commentId = requireId(input.commentId, 'commentId');
  return `comment__${postId}__${commentId}__${reporterUid}`;
}

export function validateReportDraft(input: ReportDraft): { reasonCode: ReportReasonCode; details: string } {
  if (!REPORT_REASON_CODES.includes(input.reasonCode as ReportReasonCode)) {
    throw new Error('Report reason is invalid.');
  }
  const details = input.details.trim();
  if (details.length > 2000) throw new Error('Report details must not exceed 2000 characters.');
  return { reasonCode: input.reasonCode as ReportReasonCode, details };
}
