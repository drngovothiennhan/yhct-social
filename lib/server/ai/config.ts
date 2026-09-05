export interface AiConfig {
  apiKey: string;
  fastModel: string;
  reasoningModel?: string;
  fileSearchStore?: string;
  dailyRequestLimit: number;
  perUserWindowLimit: number;
  maxTextChars: number;
  maxDocxBytes: number;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`AI_CONFIG_MISSING ${name}`);
  return value;
}

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`AI_CONFIG_INVALID ${name}`);
  return value;
}

export function getAiConfig(): AiConfig {
  return {
    apiKey: requireEnv('GEMINI_API_KEY'),
    fastModel: process.env.GEMINI_MODEL_FAST?.trim() || 'gemini-2.5-flash',
    reasoningModel: process.env.GEMINI_MODEL_REASONING?.trim() || undefined,
    fileSearchStore: process.env.GEMINI_FILE_SEARCH_STORE?.trim() || undefined,
    dailyRequestLimit: positiveInt('AI_DAILY_REQUEST_LIMIT', 200),
    perUserWindowLimit: positiveInt('AI_PER_USER_WINDOW_LIMIT', 10),
    maxTextChars: positiveInt('AI_MAX_TEXT_CHARS', 24000),
    maxDocxBytes: positiveInt('AI_MAX_DOCX_BYTES', 5 * 1024 * 1024),
  };
}
