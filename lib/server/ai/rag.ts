import { getAiConfig } from './config.ts';
import { createGeminiProvider, type GeminiGroundedRequest, type GeminiGroundedResult } from './gemini.ts';
import { assertAiSafeText } from './privacy.ts';
import { consumeAiQuota } from './quota.ts';
import { RagAnswerSchema, RagQueryInputSchema, type AiActor, type AiSource, type RagAnswer, type RagQueryInput } from './types.ts';

export class AiRagError extends Error {
  readonly code: 'AI_QUOTA_EXCEEDED' | 'AI_INTERNAL_RAG_NOT_CONFIGURED' | 'AI_PERSONALIZED_CLINICAL_REQUEST';

  constructor(code: 'AI_QUOTA_EXCEEDED' | 'AI_INTERNAL_RAG_NOT_CONFIGURED' | 'AI_PERSONALIZED_CLINICAL_REQUEST') {
    super(code);
    this.name = 'AiRagError';
    this.code = code;
  }
}

export interface RagDeps {
  model: string;
  fileSearchStore?: string;
  consumeQuota(actor: AiActor, operation: 'rag_internal' | 'rag_external'): Promise<{ allowed: boolean }>;
  generate(request: GeminiGroundedRequest): Promise<GeminiGroundedResult>;
  resolveInternalSources(chunks: GeminiGroundedResult['chunks']): Promise<AiSource[]>;
}

function looksPersonalizedClinical(query: string): boolean {
  const normalized = query.toLowerCase();
  const firstPerson = /\b(tôi|mình|em|con|bố tôi|mẹ tôi|vợ tôi|chồng tôi)\b/u.test(normalized);
  const treatmentIntent = /\b(chẩn đoán|điều trị|uống thuốc|dùng thuốc|toa thuốc|kê đơn|liều dùng|bệnh gì|nên chữa)\b/u.test(normalized);
  return firstPerson && treatmentIntent;
}

function safeExternalSources(chunks: GeminiGroundedResult['chunks']): AiSource[] {
  const seen = new Set<string>();
  const sources: AiSource[] = [];
  for (const chunk of chunks) {
    if (chunk.kind !== 'web' || !chunk.uri) continue;
    let url: URL;
    try {
      url = new URL(chunk.uri);
    } catch {
      continue;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
    const id = url.toString();
    if (seen.has(id)) continue;
    seen.add(id);
    sources.push({ id, title: chunk.title?.trim() || url.hostname, uri: id });
    if (sources.length >= 30) break;
  }
  return sources;
}

export async function queryRagWithDeps(
  mode: 'internal' | 'external',
  input: RagQueryInput,
  actor: AiActor,
  deps: RagDeps,
): Promise<RagAnswer> {
  const parsed = RagQueryInputSchema.parse(input);
  const { sanitized } = assertAiSafeText({ text: parsed.query });
  if (looksPersonalizedClinical(sanitized)) throw new AiRagError('AI_PERSONALIZED_CLINICAL_REQUEST');

  const operation = mode === 'internal' ? 'rag_internal' : 'rag_external';
  const quota = await deps.consumeQuota(actor, operation);
  if (!quota.allowed) throw new AiRagError('AI_QUOTA_EXCEEDED');

  let tools: GeminiGroundedRequest['tools'];
  if (mode === 'internal') {
    if (!deps.fileSearchStore) throw new AiRagError('AI_INTERNAL_RAG_NOT_CONFIGURED');
    tools = [{ fileSearch: { fileSearchStoreNames: [deps.fileSearchStore] } }];
  } else {
    tools = [{ googleSearch: {} }];
  }

  const response = await deps.generate({
    model: deps.model,
    prompt: sanitized,
    systemInstruction: mode === 'internal'
      ? 'Trả lời như trợ lý nghiên cứu YHCT của CLB. Chỉ dựa trên nguồn File Search nội bộ được truy xuất. Nếu bằng chứng không đủ, nói rõ là không đủ dữ liệu. Không đưa chẩn đoán hay phác đồ cá nhân hóa.'
      : 'Trả lời như trợ lý nghiên cứu y văn. Chỉ tổng hợp thông tin có grounding từ Google Search. Nếu bằng chứng không đủ, nói rõ giới hạn. Không đưa chẩn đoán hay phác đồ cá nhân hóa.',
    tools,
  });

  const sources = mode === 'internal'
    ? await deps.resolveInternalSources(response.chunks.filter((chunk) => chunk.kind === 'retrieved'))
    : safeExternalSources(response.chunks);

  const grounded = sources.length > 0;
  return RagAnswerSchema.parse({
    mode,
    answer: response.text,
    sources: grounded ? sources : [],
    grounded,
    degraded: grounded ? undefined : true,
  });
}

async function resolveManifestSources(chunks: GeminiGroundedResult['chunks']): Promise<AiSource[]> {
  const retrieved = chunks.filter((chunk) => chunk.kind === 'retrieved');
  if (retrieved.length === 0) return [];
  const { rootAdminDb } = await import('../firebase-admin.ts');
  const snapshot = await rootAdminDb().collection('aiKnowledgeSources').where('status', '==', 'ready').limit(50).get();
  const manifests: Array<{ id: string; title: string }> = snapshot.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      title: typeof data.title === 'string' ? data.title : '',
    };
  });
  const sources: AiSource[] = [];
  const seen = new Set<string>();
  for (const chunk of retrieved) {
    const title = chunk.title?.trim();
    const match = manifests.find((item) => {
      const manifestTitle = item.title;
      return Boolean(title && manifestTitle && (manifestTitle === title || manifestTitle.includes(title) || title.includes(manifestTitle)));
    });
    if (!match) continue;
    if (seen.has(match.id)) continue;
    seen.add(match.id);
    sources.push({ id: match.id, title: match.title || 'Nguồn nội bộ' });
    if (sources.length >= 30) break;
  }
  return sources;
}

export async function queryInternalRag(input: RagQueryInput, actor: AiActor): Promise<RagAnswer> {
  const config = getAiConfig();
  const provider = createGeminiProvider();
  return queryRagWithDeps('internal', input, actor, {
    model: config.fastModel,
    fileSearchStore: config.fileSearchStore,
    consumeQuota: (value, operation) => consumeAiQuota(value, operation),
    generate: (request) => provider.generateGrounded(request),
    resolveInternalSources: resolveManifestSources,
  });
}

export async function queryExternalRag(input: RagQueryInput, actor: AiActor): Promise<RagAnswer> {
  const config = getAiConfig();
  const provider = createGeminiProvider();
  return queryRagWithDeps('external', input, actor, {
    model: config.fastModel,
    consumeQuota: (value, operation) => consumeAiQuota(value, operation),
    generate: (request) => provider.generateGrounded(request),
    resolveInternalSources: async () => [],
  });
}
