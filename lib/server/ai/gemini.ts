import { GoogleGenAI } from '@google/genai';
import { z, type ZodType } from 'zod';
import { getAiConfig } from './config.ts';

export interface GeminiStructuredRequest<T> {
  model?: string;
  prompt: string;
  systemInstruction?: string;
  schema: ZodType<T>;
}

export type GeminiGroundingTool =
  | { fileSearch: { fileSearchStoreNames: string[] } }
  | { googleSearch: Record<string, never> };

export interface GeminiGroundedRequest {
  model?: string;
  prompt: string;
  systemInstruction?: string;
  tools: GeminiGroundingTool[];
}

export interface GeminiGroundedChunk {
  kind: 'retrieved' | 'web';
  title?: string;
  uri?: string;
  fileSearchStore?: string;
}

export interface GeminiGroundedResult {
  text: string;
  chunks: GeminiGroundedChunk[];
}

export interface GeminiProvider {
  generateStructured<T>(request: GeminiStructuredRequest<T>): Promise<T>;
  generateGrounded(request: GeminiGroundedRequest): Promise<GeminiGroundedResult>;
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

function safeOptionalString(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
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

    async generateGrounded(request: GeminiGroundedRequest): Promise<GeminiGroundedResult> {
      try {
        const response = await client.models.generateContent({
          model: request.model || config.fastModel,
          contents: request.prompt,
          config: {
            systemInstruction: request.systemInstruction,
            tools: request.tools,
          },
        });
        const text = response.text?.trim();
        if (!text) throw new AiProviderError('AI_PROVIDER_INVALID_OUTPUT');

        const chunks: GeminiGroundedChunk[] = [];
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
        for (const chunk of groundingChunks) {
          if (chunk.web) {
            chunks.push({
              kind: 'web',
              title: safeOptionalString(chunk.web.title, 500),
              uri: safeOptionalString(chunk.web.uri, 2000),
            });
            continue;
          }
          if (chunk.retrievedContext) {
            chunks.push({
              kind: 'retrieved',
              title: safeOptionalString(chunk.retrievedContext.title, 500),
              uri: safeOptionalString(chunk.retrievedContext.uri, 2000),
              fileSearchStore: safeOptionalString(chunk.retrievedContext.fileSearchStore, 500),
            });
          }
        }
        return { text, chunks };
      } catch (error) {
        if (error instanceof AiProviderError) throw error;
        throw normalizeProviderFailure(error);
      }
    },
  };
}
