import type { DecodedIdToken } from 'firebase-admin/auth';
import { rootAdminAuth } from '@/lib/server/firebase-admin';

export type ClubMemberRole = 'member' | 'mod' | 'super_mod' | 'admin';

export interface ClubMemberActor {
  uid: string;
  role: ClubMemberRole;
  clubMember: true;
  mustChangePassword: false;
}

export class ClubMemberAuthError extends Error {
  constructor(public readonly code: 'CLUB_AUTH_REQUIRED' | 'CLUB_AUTH_INVALID' | 'CLUB_MEMBERSHIP_REQUIRED' | 'PASSWORD_ROTATION_REQUIRED') {
    super(code);
    this.name = 'ClubMemberAuthError';
  }
}

function bearerToken(request: Request): string {
  const header = request.headers.get('authorization')?.trim() ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match?.[1]) throw new ClubMemberAuthError('CLUB_AUTH_REQUIRED');
  return match[1];
}

function normalizeRole(decoded: DecodedIdToken): ClubMemberRole {
  const raw = decoded.role === 'moderator' ? 'mod' : decoded.role;
  return raw === 'mod' || raw === 'super_mod' || raw === 'admin' ? raw : 'member';
}

export async function requireClubMember(request: Request): Promise<ClubMemberActor> {
  let decoded: DecodedIdToken;
  try {
    decoded = await rootAdminAuth().verifyIdToken(bearerToken(request), true);
  } catch (error) {
    if (error instanceof ClubMemberAuthError) throw error;
    throw new ClubMemberAuthError('CLUB_AUTH_INVALID');
  }
  if (decoded.clubMember !== true) throw new ClubMemberAuthError('CLUB_MEMBERSHIP_REQUIRED');
  if (decoded.mustChangePassword === true) throw new ClubMemberAuthError('PASSWORD_ROTATION_REQUIRED');
  return {
    uid: decoded.uid,
    role: normalizeRole(decoded),
    clubMember: true,
    mustChangePassword: false,
  };
}
