import { accErrorResponse, requireAccRole } from '@/lib/admin-auth';
import { validateRecoveryCandidate } from '@/lib/recovery-validation';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ manifestId: string }> }) {
  try {
    const principal = await requireAccRole(request, 'admin');
    const { manifestId } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const validationSummary = await validateRecoveryCandidate({
      manifestId,
      operationId: body.operationId,
      reason: body.reason,
    }, {
      uid: principal.token.uid,
      role: 'admin',
    });
    return Response.json({ validationSummary }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return accErrorResponse(error);
  }
}
