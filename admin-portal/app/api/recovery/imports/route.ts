import { accErrorResponse, requireAccRole } from '@/lib/admin-auth';
import { startImportFromCheckpoint } from '@/lib/recovery-restore';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const principal = await requireAccRole(request, 'admin');
    const body = await request.json() as Record<string, unknown>;
    const result = await startImportFromCheckpoint({
      operationId: body.operationId,
      reason: body.reason,
      manifestId: body.manifestId,
    }, { uid: principal.token.uid, role: 'admin' });
    return Response.json(result, { status: result.replayed ? 200 : 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return accErrorResponse(error);
  }
}
