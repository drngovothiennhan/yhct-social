import { accErrorResponse, requireAccRole } from '@/lib/admin-auth';
import { removeKnowledgeSource } from '@/lib/ai-knowledge';

export const runtime = 'nodejs';

export async function DELETE(
  request: Request,
  context: { params: Promise<{ sourceId: string }> },
) {
  try {
    const principal = await requireAccRole(request, 'super_mod');
    const { sourceId } = await context.params;
    await removeKnowledgeSource(sourceId, {
      uid: principal.token.uid,
      role: principal.claims.role,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return accErrorResponse(error);
  }
}
