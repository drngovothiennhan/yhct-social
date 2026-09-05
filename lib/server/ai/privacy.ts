import { createHash } from 'node:crypto';

export interface AiSafeTextResult {
  sanitized: string;
  contentHash: string;
}

export class AiPrivacyError extends Error {
  constructor(public readonly code: 'AI_SENSITIVE_DATA' | 'AI_CLINICAL_NOT_DEIDENTIFIED') {
    super(code);
    this.name = 'AiPrivacyError';
  }
}

function normalizeText(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

const SENSITIVE_PATTERNS: RegExp[] = [
  /\b(?:mssv|mã\s*số\s*sinh\s*viên|student\s*id)\s*[:=]\s*[a-z0-9._-]{4,}\b/iu,
  /\b(?:mật\s*khẩu|password|passcode)\s*[:=]\s*\S{4,}\b/iu,
  /\b(?:cccd|cmnd|căn\s*cước(?:\s*công\s*dân)?)\s*[:=]\s*\d{9,12}\b/iu,
  /\bemail\s*[:=]\s*[^\s@]+@[^\s@]+\.[^\s@]+/iu,
  /\b(?:minh\s*chứng|chứng\s*chỉ|certificate(?:\s*evidence)?)\b[^\n]{0,180}\bcertificates\//iu,
  /\bcertificates\/[a-z0-9._/-]+/iu,
];

const CLINICAL_DIRECT_IDENTIFIER_PATTERNS: RegExp[] = [
  /\b(?:sđt|số\s*điện\s*thoại|điện\s*thoại|phone)\s*[:=]?\s*(?:\+?84|0)\d{8,10}\b/iu,
  /\b(?:bệnh\s*nhân|patient)\s+[\p{L}][\p{L}\s.'-]{2,60}(?=\s*[,;])/iu,
  /\b(?:cccd|cmnd)\s*[:=]?\s*\d{9,12}\b/iu,
  /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/iu,
];

export function assertAiSafeText(input: { text: string; clinicalCase?: boolean }): AiSafeTextResult {
  const sanitized = normalizeText(input.text);
  if (!sanitized) throw new AiPrivacyError('AI_SENSITIVE_DATA');

  if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(sanitized))) {
    throw new AiPrivacyError('AI_SENSITIVE_DATA');
  }

  if (input.clinicalCase && CLINICAL_DIRECT_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(sanitized))) {
    throw new AiPrivacyError('AI_CLINICAL_NOT_DEIDENTIFIED');
  }

  return {
    sanitized,
    contentHash: createHash('sha256').update(sanitized, 'utf8').digest('hex'),
  };
}
