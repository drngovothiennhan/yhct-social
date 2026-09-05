import { NextResponse } from 'next/server';
import { requireAiUser, AiAuthError } from '@/lib/server/ai/auth';
import { AiPrivacyError } from '@/lib/server/ai/privacy';
import { AiProviderError } from '@/lib/server/ai/gemini';
import { AiRagError, queryExternalRag } from '@/lib/server/ai/rag';
import { RagQueryInputSchema } from '@/lib/server/ai/types';

function statusFor(error: unknown): number {
  if (error instanceof AiAuthError) return error.code === 'AI_AUTH_REQUIRED' || error.code === 'AI_AUTH_INVALID' ? 401 : 403;
  if (error instanceof AiPrivacyError) return 400;
  if (error instanceof AiRagError) {
    if (error.code === 'AI_QUOTA_EXCEEDED') return 429;
    if (error.code === 'AI_PERSONALIZED_CLINICAL_REQUEST') return 400;
    return 503;
  }
  if (error instanceof AiProviderError) return error.code === 'AI_PROVIDER_QUOTA' ? 429 : 503;
  return 500;
}

function safeCode(error: unknown): string {
  if (error instanceof AiAuthError || error instanceof AiPrivacyError || error instanceof AiRagError || error instanceof AiProviderError) return error.code;
  return 'AI_REQUEST_FAILED';
}

export async function POST(request: Request) {
  try {
    const actor = await requireAiUser(request);
    const parsed = RagQueryInputSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'AI_INPUT_INVALID' }, { status: 400 });
    const result = await queryExternalRag(parsed.data, actor);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: safeCode(error) }, { status: statusFor(error) });
  }
}
