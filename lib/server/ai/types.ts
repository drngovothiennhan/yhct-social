import { z } from 'zod';

export const AiRoleSchema = z.enum(['member', 'mod', 'super_mod', 'admin']);
export type AiRole = z.infer<typeof AiRoleSchema>;

export interface AiActor {
  uid: string;
  role: AiRole;
  clubMember: boolean;
  mustChangePassword: boolean;
}

export const PostAnalysisInputSchema = z.object({
  targetType: z.enum(['post', 'draft']).default('draft'),
  targetId: z.string().trim().min(1).max(160).optional(),
  text: z.string().trim().min(1).max(24000),
  clinicalCase: z.boolean().default(false),
});
export type PostAnalysisInput = z.infer<typeof PostAnalysisInputSchema>;

export const PostAnalysisResultSchema = z.object({
  category: z.enum(['clinical', 'theory', 'herbal', 'club', 'other']),
  confidence: z.number().min(0).max(1),
  safetySignals: z.array(z.string().trim().min(1).max(80)).max(20),
  rationale: z.string().trim().max(1200),
  cacheHit: z.boolean().optional(),
});
export type PostAnalysisResult = z.infer<typeof PostAnalysisResultSchema>;

export const RagQueryInputSchema = z.object({
  query: z.string().trim().min(2).max(4000),
});
export type RagQueryInput = z.infer<typeof RagQueryInputSchema>;

export const AiSourceSchema = z.object({
  id: z.string().trim().min(1).max(300),
  title: z.string().trim().min(1).max(500),
  uri: z.string().url().max(2000).optional(),
});
export type AiSource = z.infer<typeof AiSourceSchema>;

export const RagAnswerSchema = z.object({
  mode: z.enum(['internal', 'external']),
  answer: z.string().trim().min(1).max(20000),
  sources: z.array(AiSourceSchema).max(30),
  grounded: z.boolean(),
  degraded: z.boolean().optional(),
});
export type RagAnswer = z.infer<typeof RagAnswerSchema>;

export const HerbDraftSchema = z.object({
  name: z.string().trim().max(160),
  amount: z.string().trim().max(80),
  unit: z.string().trim().max(40),
  note: z.string().trim().max(240),
});

export const DocxDraftSchema = z.object({
  title: z.string().trim().max(180).default(''),
  summary: z.string().trim().max(4000).default(''),
  category: z.enum(['clinical', 'theory', 'herbal', 'club', 'other']).default('other'),
  batCuong: z.string().trim().max(1200).default(''),
  tangPhu: z.string().trim().max(1200).default(''),
  diagnosticPattern: z.string().trim().max(1600).default(''),
  herbs: z.array(HerbDraftSchema).max(64).default([]),
  usage: z.string().trim().max(4000).default(''),
  tags: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  uncertainties: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
});
export type DocxDraft = z.infer<typeof DocxDraftSchema>;

export type AiOperation = 'analyze_post' | 'rag_internal' | 'rag_external' | 'docx_draft';
