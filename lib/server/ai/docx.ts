import * as mammoth from 'mammoth';
import { getAiConfig } from './config';
import { createGeminiProvider } from './gemini';
import { assertAiSafeText } from './privacy';
import { consumeAiQuota } from './quota';
import { DocxDraftSchema, type AiActor, type DocxDraft } from './types';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export class AiDocxError extends Error {
  readonly code:
    | 'AI_DOCX_TYPE_INVALID'
    | 'AI_DOCX_EMPTY'
    | 'AI_DOCX_TOO_LARGE'
    | 'AI_DOCX_PARSE_FAILED'
    | 'AI_DOCX_TEXT_TOO_LARGE'
    | 'AI_QUOTA_EXCEEDED';

  constructor(code: AiDocxError['code']) {
    super(code);
    this.name = 'AiDocxError';
    this.code = code;
  }
}

export function validateDocxUpload(
  file: { name: string; type: string; size: number },
  maxBytes: number,
): { ok: true } {
  const name = file.name.trim().toLowerCase();
  const validExtension = name.endsWith('.docx');
  const validMime = file.type === DOCX_MIME || file.type === 'application/octet-stream' || file.type === '';
  if (!validExtension || !validMime) throw new AiDocxError('AI_DOCX_TYPE_INVALID');
  if (!Number.isFinite(file.size) || file.size <= 0) throw new AiDocxError('AI_DOCX_EMPTY');
  if (file.size > maxBytes) throw new AiDocxError('AI_DOCX_TOO_LARGE');
  return { ok: true };
}

export async function extractDocxDraft(bytes: Uint8Array, actor: AiActor): Promise<DocxDraft> {
  const config = getAiConfig();
  if (bytes.byteLength === 0) throw new AiDocxError('AI_DOCX_EMPTY');
  if (bytes.byteLength > config.maxDocxBytes) throw new AiDocxError('AI_DOCX_TOO_LARGE');

  let extracted: string;
  try {
    const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const result = await mammoth.extractRawText({ buffer });
    extracted = result.value.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
  } catch {
    throw new AiDocxError('AI_DOCX_PARSE_FAILED');
  }
  if (!extracted) throw new AiDocxError('AI_DOCX_PARSE_FAILED');
  if (extracted.length > config.maxTextChars) throw new AiDocxError('AI_DOCX_TEXT_TOO_LARGE');

  const { sanitized } = assertAiSafeText({ text: extracted });
  const quota = await consumeAiQuota(actor, 'docx_draft');
  if (!quota.allowed) throw new AiDocxError('AI_QUOTA_EXCEEDED');

  const provider = createGeminiProvider();
  return provider.generateStructured({
    model: config.fastModel,
    schema: DocxDraftSchema,
    systemInstruction: [
      'Bạn là trợ lý biên tập tài liệu YHCT cho CLB.',
      'Chỉ chuyển nội dung tài liệu thành bản nháp có cấu trúc; không tự bổ sung dữ kiện không có trong tài liệu.',
      'Nếu trường nào không chắc chắn, để rỗng và ghi rõ vào uncertainties.',
      'Không chẩn đoán hoặc kê đơn cho cá nhân. Không tự xuất bản nội dung.',
    ].join(' '),
    prompt: `Chuyển tài liệu sau thành bản nháp bài đăng theo schema JSON đã cung cấp:\n\n${sanitized}`,
  });
}
