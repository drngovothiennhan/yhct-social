import { accErrorResponse, requireAccRole } from '@/lib/admin-auth';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    await requireAccRole(request, 'super_mod');
    const url = new URL(request.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 30) || 30));
    const snapshot = await adminDb()
      .collection('verificationRequests')
      .where('status', '==', 'pending')
      .orderBy('submittedAt', 'asc')
      .limit(limit)
      .get();

    return Response.json({
      requests: snapshot.docs.map((item) => {
        const data = item.data();
        return {
          uid: item.id,
          status: String(data.status ?? 'pending'),
          professionalType: String(data.professionalType ?? ''),
          evidence: Array.isArray(data.evidence) ? data.evidence : [],
          attempt: Number(data.attempt ?? 1),
          submittedAt: data.submittedAt ?? null,
        };
      }),
    });
  } catch (error) {
    return accErrorResponse(error);
  }
}
