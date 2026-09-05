import { accErrorResponse, requireAccRole } from '@/lib/admin-auth';
import { validateRecoveryCandidate } from '@/lib/recovery-validation';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ manifestId: string }> }) {
  try {
    await requireAccRole(request, 'admin');
    const { manifestId } = await context.params;
    const validationSummary = await validateRecoveryCandidate(manifestId);
    return Response.json({ validationSummary }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return accErrorResponse(error);
  }
}
