import { accErrorResponse, requireAccRole } from '@/lib/admin-auth';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    await requireAccRole(request, 'mod');
    const url = new URL(request.url);
    const status = url.searchParams.get('status') ?? 'open';
    if (!['open', 'reviewing', 'resolved', 'dismissed'].includes(status)) return Response.json({ error: 'INVALID_STATUS' }, { status: 400 });
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 30), 1), 50);
    let query = adminDb().collection('reports').where('status', '==', status).orderBy('createdAt', 'asc').limit(limit);
    const cursor = url.searchParams.get('cursor');
    if (cursor) {
      const cursorDoc = await adminDb().doc(`reports/${cursor}`).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }
    const snapshot = await query.get();
    const reports = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return Response.json({ reports, nextCursor: snapshot.docs.at(-1)?.id ?? null });
  } catch (error) {
    return accErrorResponse(error);
  }
}
