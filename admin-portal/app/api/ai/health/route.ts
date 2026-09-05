import { accErrorResponse, requireAccRole } from '@/lib/admin-auth';
import { getAiQuotaSummary } from '@/lib/ai-ops';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    await requireAccRole(request, 'mod');
    const quota = await getAiQuotaSummary();
    return Response.json({
      configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      fastModel: process.env.GEMINI_MODEL_FAST?.trim() || 'gemini-2.5-flash',
      fileSearchConfigured: Boolean(process.env.GEMINI_FILE_SEARCH_STORE?.trim()),
      driveConfigured: Boolean(process.env.AI_DRIVE_FOLDER_ID?.trim()),
      quota,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return accErrorResponse(error);
  }
}
