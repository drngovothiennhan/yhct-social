import { accErrorResponse, requireAccRole } from '@/lib/admin-auth';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    await requireAccRole(request, 'admin');
    const url = new URL(request.url);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 30), 1), 50);
    let query = adminDb().collection('adminAudit').orderBy('createdAt', 'desc').limit(pageSize);
    const cursor = url.searchParams.get('cursor');
    if (cursor) {
      const cursorDoc = await adminDb().doc(`adminAudit/${cursor}`).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }
    const snapshot = await query.get();
    return Response.json({
      events: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      nextCursor: snapshot.docs.at(-1)?.id ?? null,
    });
  } catch (error) {
    return accErrorResponse(error);
  }
}
