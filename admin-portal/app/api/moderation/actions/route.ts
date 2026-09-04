import { accErrorResponse, requireAccRole, AccHttpError } from '@/lib/admin-auth';
import { canRestore } from '@/lib/module-c-policy';
import { resolveReportTransaction, restoreContentTransaction, type ModerationAction } from '@/lib/moderation';

export const runtime = 'nodejs';

function text(value: unknown, field: string, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new AccHttpError(400, `INVALID_${field.toUpperCase()}`);
  return value.trim();
}

export async function POST(request: Request) {
  try {
    const principal = await requireAccRole(request, 'mod');
    const body = await request.json() as Record<string, unknown>;
    const operationId = text(body.operationId, 'operationId', 120);
    const action = String(body.action ?? '') as ModerationAction;
    const reason = text(body.reason, 'reason', 2000);

    if (action === 'restore') {
      if (!canRestore(principal.claims.role)) throw new AccHttpError(403, 'FORBIDDEN');
      const targetType = body.targetType === 'comment' ? 'comment' : body.targetType === 'post' ? 'post' : null;
      if (!targetType) throw new AccHttpError(400, 'INVALID_TARGET_TYPE');
      const result = await restoreContentTransaction({
        actorUid: principal.token.uid,
        actorRole: principal.claims.role,
        operationId,
        targetType,
        postId: text(body.postId, 'postId', 256),
        commentId: targetType === 'comment' ? text(body.commentId, 'commentId', 256) : null,
        reason,
      });
      return Response.json({ ok: true, ...result });
    }

    if (!['keep', 'hide', 'soft_delete', 'dismiss'].includes(action)) throw new AccHttpError(400, 'INVALID_ACTION');
    const result = await resolveReportTransaction({
      actorUid: principal.token.uid,
      actorRole: principal.claims.role,
      operationId,
      reportId: text(body.reportId, 'reportId', 512),
      action: action as Exclude<ModerationAction, 'restore'>,
      reason,
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return accErrorResponse(error);
  }
}
