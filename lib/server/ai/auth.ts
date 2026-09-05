import type { DecodedIdToken } from 'firebase-admin/auth';
import { rootAdminAuth } from '@/lib/server/firebase-admin';
import { AiRoleSchema, type AiActor } from '@/lib/server/ai/types';

export class AiAuthError extends Error {
  constructor(public readonly code: 'AI_AUTH_REQUIRED' | 'AI_AUTH_INVALID' | 'AI_PASSWORD_ROTATION_REQUIRED') {
    super(code);
    this.name = 'AiAuthError';
  }
}

function normalizeRole(decoded: DecodedIdToken): AiActor['role'] {
  const raw = decoded.role === 'moderator' ? 'mod' : decoded.role;
  const parsed = AiRoleSchema.safeParse(raw);
  return parsed.success ? parsed.data : 'member';
}

export async function requireAiUser(request: Request): Promise<AiActor> {
  const header = request.headers.get('authorization')?.trim() ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match?.[1]) throw new AiAuthError('AI_AUTH_REQUIRED');

  let decoded: DecodedIdToken;
  try {
    decoded = await rootAdminAuth().verifyIdToken(match[1], true);
  } catch {
    throw new AiAuthError('AI_AUTH_INVALID');
  }

  const actor: AiActor = {
    uid: decoded.uid,
    role: normalizeRole(decoded),
    clubMember: decoded.clubMember === true,
    mustChangePassword: decoded.mustChangePassword === true,
  };

  if (actor.mustChangePassword) throw new AiAuthError('AI_PASSWORD_ROTATION_REQUIRED');
  return actor;
}
