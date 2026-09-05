import { NextResponse } from 'next/server';
import { requireAiUser, AiAuthError } from '@/lib/server/ai/auth';
import { getAiConfig } from '@/lib/server/ai/config';
import { AiDocxError, extractDocxDraft, validateDocxUpload } from '@/lib/server/ai/docx';
import { AiPrivacyError } from '@/lib/server/ai/privacy';
import { AiProviderError } from '@/lib/server/ai/gemini';

export const runtime = 'nodejs';

function statusFor(error: unknown): number {
  if (error instanceof AiAuthError) return error.code === 'AI_AUTH_REQUIRED' || error.code === 'AI_AUTH_INVALID' ? 401 : 403;
  if (error instanceof AiPrivacyError) return 400;
  if (error instanceof AiDocxError) {
    if (error.code === 'AI_DOCX_TOO_LARGE' || error.code === 'AI_DOCX_TEXT_TOO_LARGE') return 413;
    if (error.code === 'AI_QUOTA_EXCEEDED') return 429;
    return 400;
  }
  if (error instanceof AiProviderError) return error.code === 'AI_PROVIDER_QUOTA' ? 429 : 503;
  return 500;
}

function safeCode(error: unknown): string {
  if (error instanceof AiAuthError || error instanceof AiPrivacyError || error instanceof AiDocxError || error instanceof AiProviderError) return error.code;
  return 'AI_REQUEST_FAILED';
}

export async function POST(request: Request) {
  try {
    const actor = await requireAiUser(request);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'AI_DOCX_FILE_REQUIRED' }, { status: 400 });
    const config = getAiConfig();
    validateDocxUpload({ name: file.name, type: file.type, size: file.size }, config.maxDocxBytes);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const draft = await extractDocxDraft(bytes, actor);
    return NextResponse.json(draft, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: safeCode(error) }, { status: statusFor(error) });
  }
}
