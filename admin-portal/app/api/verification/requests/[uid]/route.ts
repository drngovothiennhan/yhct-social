import { accErrorResponse, requireAccRole, AccHttpError } from '@/lib/admin-auth';
import { decideVerificationTransaction } from '@/lib/verification';

export const runtime = 'nodejs';

function text(value: unknown, field: string, max: number, required = true): string {
  const result = typeof value === 'string' ? value.trim() : '';
  if ((required && !result) || result.length > max) throw new AccHttpError(400, `INVALID_${field.toUpperCase()}`);
  return result;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ uid: string }> },
) {
  try {
    const principal = await requireAccRole(request, 'super_mod');
    if (principal.claims.role !== 'super_mod' && principal.claims.role !== 'admin') {
      throw new AccHttpError(403, 'FORBIDDEN');
    }

    const { uid } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const decision = body.decision === 'verified' || body.decision === 'rejected'
      ? body.decision
      : null;
    if (!decision) throw new AccHttpError(400, 'INVALID_DECISION');

    const operationId = text(body.operationId, 'operationId', 120);
    const reason = text(body.reason, 'reason', 2000, decision === 'rejected');

    const result = await decideVerificationTransaction({
      actorUid: principal.token.uid,
      actorRole: principal.claims.role,
      operationId,
      uid: text(uid, 'uid', 128),
      decision,
      reason,
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    return accErrorResponse(error);
  }
}
