import { accErrorResponse, requireAccRole } from '@/lib/admin-auth';
import { recoveryProvider } from '@/lib/recovery-provider';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    await requireAccRole(request, 'admin');
    const backups = await recoveryProvider().listManagedBackups();
    return Response.json({ backups }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return accErrorResponse(error);
  }
}
