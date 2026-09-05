import { accErrorResponse, requireAccRole } from '@/lib/admin-auth';
import { decideRecoveryManifest } from '@/lib/recovery-validation';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ manifestId: string }> }) {
  try {
    const principal = await requireAccRole(request, 'admin');
    const { manifestId } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const decision = body.decision === 'verified' || body.decision === 'rejected' ? body.decision : null;
    if (!decision) return Response.json({ error: 'RECOVERY_VALIDATION_FAILED' }, { status: 400 });
    const result = await decideRecoveryManifest({
      manifestId,
      decision,
      operationId: body.operationId,
      reason: body.reason,
    }, { uid: principal.token.uid, role: 'admin' });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return accErrorResponse(error);
  }
}
