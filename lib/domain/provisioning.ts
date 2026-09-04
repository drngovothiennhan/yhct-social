import { randomBytes } from 'node:crypto';
import type { ClubRole } from './rbac.ts';
import { roleRank } from './rbac.ts';

export const MEMBER_EMAIL_DOMAIN = 'members.yhct.hiu.vn';

export interface RosterRow {
  memberCode: string;
  displayName: string;
  faculty: string;
  title: string;
}

export interface ProvisioningMember extends RosterRow {
  role: ClubRole;
  sourceConflict: boolean;
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function foldVietnamese(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeMemberCode(value: unknown): string {
  const memberCode = clean(value).replace(/\.0$/, '');
  if (!memberCode) throw new Error('MSSV không được để trống.');
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(memberCode)) {
    throw new Error(`MSSV không hợp lệ: ${memberCode}`);
  }
  return memberCode.toLowerCase();
}

export function memberCodeToSyntheticEmail(value: unknown): string {
  return `${normalizeMemberCode(value)}@${MEMBER_EMAIL_DOMAIN}`;
}

export function mapTitleToRole(value: unknown): ClubRole {
  const title = foldVietnamese(clean(value));
  if (title.includes('pho chu nhiem')) return 'super_mod';
  if (title.includes('chu nhiem')) return 'admin';
  if (title.includes('ban quan ly') || title.includes('truong ban')) return 'mod';
  return 'member';
}

export function dedupeRosterRows(rows: RosterRow[]): ProvisioningMember[] {
  const byCode = new Map<string, ProvisioningMember>();

  for (const source of rows) {
    const memberCode = normalizeMemberCode(source.memberCode);
    const displayName = clean(source.displayName);
    const faculty = clean(source.faculty);
    const title = clean(source.title);
    const role = mapTitleToRole(title);
    const existing = byCode.get(memberCode);

    if (!existing) {
      byCode.set(memberCode, {
        memberCode,
        displayName,
        faculty,
        title,
        role,
        sourceConflict: false,
      });
      continue;
    }

    const sourceConflict = existing.sourceConflict
      || foldVietnamese(existing.displayName) !== foldVietnamese(displayName)
      || foldVietnamese(existing.faculty) !== foldVietnamese(faculty)
      || foldVietnamese(existing.title) !== foldVietnamese(title);

    if (roleRank(role) > roleRank(existing.role)) {
      existing.role = role;
      existing.title = title;
    }
    existing.sourceConflict = sourceConflict;
  }

  return [...byCode.values()];
}

export function generateActivationPassword(): string {
  return `Aa7-${randomBytes(18).toString('base64url')}`;
}

export function buildProvisioningSummary(members: ProvisioningMember[]) {
  const roles: Record<ClubRole, number> = {
    member: 0,
    mod: 0,
    super_mod: 0,
    admin: 0,
  };
  let conflicts = 0;
  for (const member of members) {
    roles[member.role] += 1;
    if (member.sourceConflict) conflicts += 1;
  }
  return { members: members.length, roles, conflicts };
}
