import { accErrorResponse, requireAccRole } from '@/lib/admin-auth';
import { startRestoreToRecoveryDatabase } from '@/lib/recovery-restore';
import { currentReleaseSha } from '@/lib/release-identity';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const principal = await requireAccRole(request, 'admin');
    const body = await request.json() as Record<string, unknown>;
    const result = await startRestoreToRecoveryDatabase({
      operationId: body.operationId,
      reason: body.reason,
      backupId: body.backupId,
      sourceReleaseSha: currentReleaseSha(),
    }, { uid: principal.token.uid, role: 'admin' });
    return Response.json(result, { status: result.replayed ? 200 : 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return accErrorResponse(error);
  }
}
