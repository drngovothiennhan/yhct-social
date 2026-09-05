import { accErrorResponse, requireAccRole } from '@/lib/admin-auth';
import { getRecoveryState, setRecoveryState } from '@/lib/recovery-state';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    await requireAccRole(request, 'mod');
    const state = await getRecoveryState();
    return Response.json({ state }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return accErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireAccRole(request, 'admin');
    const body = await request.json() as Record<string, unknown>;
    const result = await setRecoveryState({
      mode: body.mode,
      reason: body.reason,
      operationId: body.operationId,
    }, { uid: principal.token.uid, role: 'admin' });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return accErrorResponse(error);
  }
}
