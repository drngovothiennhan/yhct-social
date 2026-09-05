import { accErrorResponse, requireAccRole, AccHttpError } from '@/lib/admin-auth';
import { syncDriveSource } from '@/lib/ai-knowledge';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const principal = await requireAccRole(request, 'mod');
    const body = await request.json() as Record<string, unknown>;
    const driveFileId = typeof body.driveFileId === 'string' ? body.driveFileId.trim() : '';
    if (!driveFileId || driveFileId.length > 240) throw new AccHttpError(400, 'INVALID_DRIVE_FILE_ID');
    const result = await syncDriveSource(
      { driveFileId },
      { uid: principal.token.uid, role: principal.claims.role },
    );
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return accErrorResponse(error);
  }
}
