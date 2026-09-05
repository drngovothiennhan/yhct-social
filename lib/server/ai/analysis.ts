import { PostAnalysisResultSchema, type AiActor, type PostAnalysisInput, type PostAnalysisResult } from './types.ts';
import { assertAiSafeText } from './privacy.ts';
import { makeAiCacheKey, type QuotaDecision } from './quota.ts';
import type { GeminiProvider } from './gemini.ts';

export interface AnalysisDeps {
  modelVersion: string;
  consumeQuota(actor: AiActor): Promise<QuotaDecision>;
  read(id: string): Promise<PostAnalysisResult | null>;
  write(id: string, value: PostAnalysisResult): Promise<void>;
  provider: GeminiProvider;
}

export class AiAnalysisError extends Error {
  readonly code: 'AI_QUOTA_EXCEEDED';

  constructor(code: 'AI_QUOTA_EXCEEDED') {
    super(code);
    this.name = 'AiAnalysisError';
    this.code = code;
  }
}

function analysisSchema() {
  return PostAnalysisResultSchema.omit({ cacheHit: true });
}

export async function analyzePostWithDeps(
  input: PostAnalysisInput,
  actor: AiActor,
  deps: AnalysisDeps,
): Promise<PostAnalysisResult> {
  const safe = assertAiSafeText({ text: input.text, clinicalCase: input.clinicalCase });
  const targetKey = input.targetId || 'draft';
  const analysisId = makeAiCacheKey(`${input.targetType}:${targetKey}`, safe.contentHash, deps.modelVersion);
  const cached = await deps.read(analysisId);
  if (cached) return { ...cached, cacheHit: true };

  const quota = await deps.consumeQuota(actor);
  if (!quota.allowed) throw new AiAnalysisError('AI_QUOTA_EXCEEDED');

  const generated = await deps.provider.generateStructured({
    model: deps.modelVersion,
    schema: analysisSchema(),
    systemInstruction: [
      'Bạn là trợ lý phân loại và an toàn nội dung học thuật YHCT.',
      'Chỉ phân tích; không ra lệnh xóa bài, khóa tài khoản, thay đổi vai trò hay duyệt chứng chỉ.',
      'Trả JSON đúng schema, rationale ngắn và không suy diễn dữ liệu cá nhân.',
    ].join(' '),
    prompt: `Phân loại nội dung sau và ghi các tín hiệu an toàn nếu có:\n\n${safe.sanitized}`,
  });
  const validated = analysisSchema().parse(generated);
  const stored: PostAnalysisResult = { ...validated, cacheHit: false };
  await deps.write(analysisId, stored);
  return stored;
}

export async function analyzePost(input: PostAnalysisInput, actor: AiActor): Promise<PostAnalysisResult> {
  const [{ consumeAiQuota }, { createGeminiProvider }, { getAiConfig }, { rootAdminDb }, firestore] = await Promise.all([
    import('./quota.ts'),
    import('./gemini'),
    import('./config'),
    import('../firebase-admin'),
    import('firebase-admin/firestore'),
  ]);
  const config = getAiConfig();
  const db = rootAdminDb();

  return analyzePostWithDeps(input, actor, {
    modelVersion: config.fastModel,
    consumeQuota: (quotaActor) => consumeAiQuota(quotaActor, 'analyze_post'),
    provider: createGeminiProvider(),
    async read(id) {
      const snapshot = await db.collection('aiAnalyses').doc(id).get();
      if (!snapshot.exists) return null;
      const data = snapshot.data() ?? {};
      const parsed = PostAnalysisResultSchema.safeParse({
        category: data.category,
        confidence: data.confidence,
        safetySignals: data.safetySignals,
        rationale: data.rationale,
        cacheHit: true,
      });
      return parsed.success ? parsed.data : null;
    },
    async write(id, value) {
      const safeValue = { ...value };
      delete safeValue.cacheHit;
      await db.collection('aiAnalyses').doc(id).set({
        ...safeValue,
        targetType: input.targetType,
        ...(input.targetId ? { targetId: input.targetId } : {}),
        requesterUid: actor.uid,
        modelVersion: config.fastModel,
        createdAt: firestore.FieldValue.serverTimestamp(),
      }, { merge: false });
    },
  });
}
