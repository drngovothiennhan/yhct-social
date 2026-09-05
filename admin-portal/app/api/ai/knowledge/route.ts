import { accErrorResponse, requireAccRole } from '@/lib/admin-auth';
import { listKnowledgeSources } from '@/lib/ai-knowledge';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    await requireAccRole(request, 'mod');
    const url = new URL(request.url);
    const limit = Number.parseInt(url.searchParams.get('limit') ?? '50', 10);
    const sources = await listKnowledgeSources(Number.isFinite(limit) ? limit : 50);
    return Response.json({ sources });
  } catch (error) {
    return accErrorResponse(error);
  }
}
