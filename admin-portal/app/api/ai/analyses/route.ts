import { accErrorResponse, requireAccRole } from '@/lib/admin-auth';
import { listAiAnalyses } from '@/lib/ai-ops';

export const runtime = 'nodejs';

function boundedText(value: string | null, max: number): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

export async function GET(request: Request) {
  try {
    await requireAccRole(request, 'mod');
    const url = new URL(request.url);
    const parsedLimit = Number.parseInt(url.searchParams.get('limit') ?? '30', 10);
    const result = await listAiAnalyses({
      limit: Number.isFinite(parsedLimit) ? parsedLimit : 30,
      cursor: boundedText(url.searchParams.get('cursor'), 200),
      category: boundedText(url.searchParams.get('category'), 80),
      safetySignal: boundedText(url.searchParams.get('safetySignal'), 80),
    });
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return accErrorResponse(error);
  }
}
