import { GoogleGenAI } from '@google/genai';
import { z, type ZodType } from 'zod';
import { getAiConfig } from './config';

export interface GeminiStructuredRequest<T> {
  model?: string;
  prompt: string;
  systemInstruction?: string;
  schema: ZodType<T>;
}

export interface GeminiProvider {
  generateStructured<T>(request: GeminiStructuredRequest<T>): Promise<T>;
}

export class AiProviderError extends Error {
  readonly code: 'AI_PROVIDER_UNAVAILABLE' | 'AI_PROVIDER_INVALID_OUTPUT' | 'AI_PROVIDER_QUOTA';

  constructor(code: 'AI_PROVIDER_UNAVAILABLE' | 'AI_PROVIDER_INVALID_OUTPUT' | 'AI_PROVIDER_QUOTA') {
    super(code);
    this.name = 'AiProviderError';
    this.code = code;
  }
}

function normalizeProviderFailure(error: unknown): AiProviderError {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('429') || message.includes('quota') || message.includes('resource_exhausted')) {
    return new AiProviderError('AI_PROVIDER_QUOTA');
  }
  return new AiProviderError('AI_PROVIDER_UNAVAILABLE');
}

export function createGeminiProvider(): GeminiProvider {
  const config = getAiConfig();
  const client = new GoogleGenAI({ apiKey: config.apiKey });

  return {
    async generateStructured<T>(request: GeminiStructuredRequest<T>): Promise<T> {
      try {
        const response = await client.models.generateContent({
          model: request.model || config.fastModel,
          contents: request.prompt,
          config: {
            systemInstruction: request.systemInstruction,
            responseMimeType: 'application/json',
            responseJsonSchema: z.toJSONSchema(request.schema),
          },
        });
        const text = response.text;
        if (!text) throw new AiProviderError('AI_PROVIDER_INVALID_OUTPUT');
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new AiProviderError('AI_PROVIDER_INVALID_OUTPUT');
        }
        const validated = request.schema.safeParse(parsed);
        if (!validated.success) throw new AiProviderError('AI_PROVIDER_INVALID_OUTPUT');
        return validated.data;
      } catch (error) {
        if (error instanceof AiProviderError) throw error;
        throw normalizeProviderFailure(error);
      }
    },
  };
}
