import { accErrorResponse, requireAccRole } from '@/lib/admin-auth';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const principal = await requireAccRole(request, 'mod');
    await adminDb().collection('system').doc('config').get();
    return Response.json({
      status: 'ok',
      service: 'yhct-social-admin-portal',
      role: principal.claims.role,
    });
  } catch (error) {
    return accErrorResponse(error);
  }
}
