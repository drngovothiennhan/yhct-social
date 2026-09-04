export type MigrationRole = 'member' | 'moderator' | 'admin';
export type MigrationAccountType = 'member' | 'practitioner' | 'student' | 'patient';
export type MigrationVerificationStatus =
  | 'not_required'
  | 'unsubmitted'
  | 'pending'
  | 'verified'
  | 'rejected';
export type MigrationClaimStatus = 'unclaimed' | 'claimed';

export interface MigrationMember {
  legacyMemberKey: string;
  legacyMssv: string;
  displayName: string;
  faculty: string;
  legacyPosition: string;
  systemRole: MigrationRole;
  accountType: MigrationAccountType;
  verificationStatus: MigrationVerificationStatus;
  claimStatus: MigrationClaimStatus;
}

export interface MigrationActivity {
  id: string;
  title: string;
  eventDate: string;
  category: string;
  points: number;
  summary: string;
  content: string;
  sourceDocumentFileId: string;
  sourceImageFileId: string;
  status: 'published' | 'hidden' | 'removed';
}

function recordOf(raw: unknown, label: string): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${label} không hợp lệ.`);
  }
  return raw as Record<string, unknown>;
}

function stringField(data: Record<string, unknown>, key: string, label: string, maxLength = 500): string {
  const value = data[key];
  if (typeof value !== 'string') throw new Error(`${label} không hợp lệ.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) throw new Error(`${label} không hợp lệ.`);
  return normalized;
}

function optionalStringField(data: Record<string, unknown>, key: string, label: string, maxLength = 500): string {
  const value = data[key];
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') throw new Error(`${label} không hợp lệ.`);
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new Error(`${label} không hợp lệ.`);
  return normalized;
}

export function normalizeMigrationMember(raw: unknown): MigrationMember {
  const data = recordOf(raw, 'Thành viên migration');
  const role = stringField(data, 'systemRole', 'Vai trò', 20);
  const accountType = stringField(data, 'accountType', 'Loại tài khoản', 20);
  const verificationStatus = stringField(data, 'verificationStatus', 'Trạng thái xác minh', 20);
  const claimStatus = stringField(data, 'claimStatus', 'Trạng thái nhận tài khoản', 20);

  if (!['member', 'moderator', 'admin'].includes(role)) throw new Error('Vai trò migration không hợp lệ.');
  if (!['member', 'practitioner', 'student', 'patient'].includes(accountType)) throw new Error('Loại tài khoản migration không hợp lệ.');
  if (!['not_required', 'unsubmitted', 'pending', 'verified', 'rejected'].includes(verificationStatus)) throw new Error('Trạng thái xác minh migration không hợp lệ.');
  if (!['unclaimed', 'claimed'].includes(claimStatus)) throw new Error('Trạng thái nhận tài khoản migration không hợp lệ.');

  const legacyMemberKey = stringField(data, 'legacyMemberKey', 'Khóa thành viên', 64);
  if (!/^[a-f0-9]{64}$/i.test(legacyMemberKey)) throw new Error('Khóa thành viên migration không hợp lệ.');

  return {
    legacyMemberKey,
    legacyMssv: stringField(data, 'legacyMssv', 'MSSV', 32),
    displayName: stringField(data, 'displayName', 'Tên thành viên', 80),
    faculty: stringField(data, 'faculty', 'Khoa', 80),
    legacyPosition: stringField(data, 'legacyPosition', 'Chức vụ cũ', 120),
    systemRole: role as MigrationRole,
    accountType: accountType as MigrationAccountType,
    verificationStatus: verificationStatus as MigrationVerificationStatus,
    claimStatus: claimStatus as MigrationClaimStatus,
  };
}

export function normalizeMigrationActivity(raw: unknown): MigrationActivity {
  const data = recordOf(raw, 'Hoạt động migration');
  const points = data.points;
  if (typeof points !== 'number' || !Number.isFinite(points) || points < 0 || points > 1000) throw new Error('Điểm hoạt động migration không hợp lệ.');

  const eventDate = stringField(data, 'eventDate', 'Ngày hoạt động', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) throw new Error('Ngày hoạt động migration không hợp lệ.');

  const status = stringField(data, 'status', 'Trạng thái hoạt động', 20);
  if (!['published', 'hidden', 'removed'].includes(status)) throw new Error('Trạng thái hoạt động migration không hợp lệ.');

  return {
    id: stringField(data, 'id', 'Mã hoạt động', 128),
    title: stringField(data, 'title', 'Tiêu đề hoạt động', 180),
    eventDate,
    category: stringField(data, 'category', 'Danh mục hoạt động', 120),
    points,
    summary: stringField(data, 'summary', 'Tóm tắt hoạt động', 4000),
    content: stringField(data, 'content', 'Nội dung hoạt động', 30000),
    sourceDocumentFileId: optionalStringField(data, 'sourceDocumentFileId', 'File nguồn hoạt động', 256),
    sourceImageFileId: optionalStringField(data, 'sourceImageFileId', 'Ảnh nguồn hoạt động', 256),
    status: status as MigrationActivity['status'],
  };
}

export function validateMigrationBundle(members: readonly MigrationMember[], activities: readonly Pick<MigrationActivity, 'id'>[]): void {
  const memberKeys = new Set<string>();
  const mssvValues = new Set<string>();
  for (const member of members) {
    if (memberKeys.has(member.legacyMemberKey)) throw new Error(`Khóa thành viên trùng: ${member.legacyMemberKey}`);
    if (mssvValues.has(member.legacyMssv)) throw new Error(`MSSV trùng: ${member.legacyMssv}`);
    memberKeys.add(member.legacyMemberKey);
    mssvValues.add(member.legacyMssv);
  }

  const activityIds = new Set<string>();
  for (const activity of activities) {
    if (activityIds.has(activity.id)) throw new Error(`Mã hoạt động trùng: ${activity.id}`);
    activityIds.add(activity.id);
  }
}

export function buildMigrationSummary(members: readonly Pick<MigrationMember, 'systemRole'>[], activities: readonly Pick<MigrationActivity, 'id'>[]): { members: number; roles: Record<MigrationRole, number>; activities: number } {
  const roles: Record<MigrationRole, number> = { admin: 0, moderator: 0, member: 0 };
  for (const member of members) roles[member.systemRole] += 1;
  return { members: members.length, roles, activities: activities.length };
}
