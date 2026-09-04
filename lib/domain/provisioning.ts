import { createHash, randomBytes } from 'node:crypto';
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

export interface ProvisioningPlanRow extends ProvisioningMember {
  syntheticEmail: string;
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

function parseCsvMatrix(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === ',' && !quoted) {
      row.push(field);
      field = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && csv[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    field += char;
  }
  row.push(field);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
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

export function parseRosterCsv(csv: string): RosterRow[] {
  const matrix = parseCsvMatrix(csv.replace(/^\uFEFF/, ''));
  const headerIndex = matrix.findIndex((row) => row.some((cell) => foldVietnamese(cell) === 'mssv'));
  if (headerIndex < 0) throw new Error('Không tìm thấy cột MSSV trong CSV.');

  const headers = matrix[headerIndex].map(foldVietnamese);
  const indexOf = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const mssvIndex = indexOf('mssv');
  const nameIndex = indexOf('ho va ten', 'ho ten');
  const facultyIndex = indexOf('khoa');
  const titleIndex = indexOf('chuc vu', 'chuc danh');
  if (mssvIndex < 0 || nameIndex < 0) throw new Error('CSV thiếu cột MSSV hoặc Họ và tên.');

  return matrix.slice(headerIndex + 1)
    .filter((row) => clean(row[mssvIndex]) !== '')
    .map((row) => ({
      memberCode: normalizeMemberCode(row[mssvIndex]),
      displayName: clean(row[nameIndex]),
      faculty: facultyIndex >= 0 ? clean(row[facultyIndex]) : '',
      title: titleIndex >= 0 ? clean(row[titleIndex]) : '',
    }));
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

export function buildProvisioningPlan(members: ProvisioningMember[]): ProvisioningPlanRow[] {
  return members.map((member) => ({
    memberCode: member.memberCode,
    syntheticEmail: memberCodeToSyntheticEmail(member.memberCode),
    displayName: member.displayName,
    faculty: member.faculty,
    title: member.title,
    role: member.role,
    sourceConflict: member.sourceConflict,
  }));
}

export function buildProvisioningSourceHash(member: ProvisioningPlanRow): string {
  const canonical = JSON.stringify({
    memberCode: normalizeMemberCode(member.memberCode),
    syntheticEmail: member.syntheticEmail.trim().toLowerCase(),
    displayName: member.displayName.trim(),
    faculty: member.faculty.trim(),
    title: member.title.trim(),
    role: member.role,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
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
