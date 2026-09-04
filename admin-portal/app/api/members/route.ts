import { accErrorResponse, requireAccRole } from '@/lib/admin-auth';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    await requireAccRole(request, 'mod');
    const url = new URL(request.url);
    const query = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const snapshot = await adminDb().collection('users').orderBy('displayName').limit(200).get();
    const rows = await Promise.all(snapshot.docs.map(async (doc) => {
      const data = doc.data();
      const authUser = await adminAuth().getUser(doc.id).catch(() => null);
      return {
        uid: doc.id,
        displayName: String(data.displayName ?? ''),
        memberCode: String(data.memberCode ?? ''),
        role: String(data.role ?? 'member'),
        clubTitle: String(data.clubTitle ?? data.professionalTitle ?? ''),
        verificationStatus: String(data.verificationStatus ?? 'not_required'),
        disabled: authUser?.disabled === true,
      };
    }));

    const filtered = query
      ? rows.filter((row) => `${row.displayName} ${row.memberCode} ${row.clubTitle}`.toLowerCase().includes(query))
      : rows;

    return Response.json({ members: filtered });
  } catch (error) {
    return accErrorResponse(error);
  }
}
