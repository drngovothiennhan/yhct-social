import { accErrorResponse, requireAccRole } from '@/lib/admin-auth';
import { listRecoveryManifests } from '@/lib/recovery-manifests';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    await requireAccRole(request, 'admin');
    const url = new URL(request.url);
    const result = await listRecoveryManifests({
      limit: url.searchParams.get('limit') ?? undefined,
      cursor: url.searchParams.get('cursor'),
    });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return accErrorResponse(error);
  }
}
