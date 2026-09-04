import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  buildMigrationSummary,
  normalizeMigrationActivity,
  normalizeMigrationMember,
  validateMigrationBundle,
} from '../lib/domain/migration.ts';

test('migration member keeps only approved staging fields', () => {
  const member = normalizeMigrationMember({
    legacyMemberKey: 'a'.repeat(64),
    legacyMssv: ' 2413000001 ',
    displayName: ' Nguyễn An ',
    faculty: ' Y ',
    legacyPosition: ' Thành viên ',
    systemRole: 'member',
    accountType: 'member',
    verificationStatus: 'not_required',
    claimStatus: 'unclaimed',
    email: 'private@example.com',
    phone: '0900000000',
    password: 'secret',
  });

  assert.deepEqual(member, {
    legacyMemberKey: 'a'.repeat(64),
    legacyMssv: '2413000001',
    displayName: 'Nguyễn An',
    faculty: 'Y',
    legacyPosition: 'Thành viên',
    systemRole: 'member',
    accountType: 'member',
    verificationStatus: 'not_required',
    claimStatus: 'unclaimed',
  });
  assert.equal('email' in member, false);
  assert.equal('phone' in member, false);
  assert.equal('password' in member, false);
});

test('migration activity remains an activity record instead of becoming a social post', () => {
  const activity = normalizeMigrationActivity({
    id: 'ACT-2026-ABC12345',
    title: 'Talkshow YHCT',
    eventDate: '2026-08-31',
    category: 'Học thuật',
    points: 10,
    summary: 'Tóm tắt',
    content: 'Nội dung hoạt động',
    sourceDocumentFileId: 'doc-id',
    sourceImageFileId: 'img-id',
    status: 'published',
  });

  assert.equal(activity.id, 'ACT-2026-ABC12345');
  assert.equal(activity.status, 'published');
  assert.equal('type' in activity, false);
  assert.equal('authorId' in activity, false);
});

test('migration bundle rejects duplicate student IDs before Firestore write', () => {
  const member = {
    legacyMemberKey: 'a'.repeat(64), legacyMssv: '2413000001', displayName: 'Nguyễn An',
    faculty: 'Y', legacyPosition: 'Thành viên', systemRole: 'member', accountType: 'member',
    verificationStatus: 'not_required', claimStatus: 'unclaimed',
  };
  assert.throws(
    () => validateMigrationBundle([member, { ...member, legacyMemberKey: 'b'.repeat(64) }], []),
    /MSSV trùng/,
  );
});

test('migration summary counts roles without exposing member details', () => {
  const members = [
    { legacyMemberKey: 'a'.repeat(64), legacyMssv: '1', displayName: 'A', faculty: 'Y', legacyPosition: 'Chủ nhiệm', systemRole: 'admin', accountType: 'member', verificationStatus: 'not_required', claimStatus: 'unclaimed' },
    { legacyMemberKey: 'b'.repeat(64), legacyMssv: '2', displayName: 'B', faculty: 'Y', legacyPosition: 'Ban quản lý', systemRole: 'moderator', accountType: 'member', verificationStatus: 'not_required', claimStatus: 'unclaimed' },
  ];
  assert.deepEqual(buildMigrationSummary(members, [{ id: 'ACT-1' }]), {
    members: 2,
    roles: { admin: 1, moderator: 1, member: 0 },
    activities: 1,
  });
});

test('migration CLI dry-run validates bundle without Firebase credentials', () => {
  const dir = mkdtempSync(join(tmpdir(), 'yhct-migration-test-'));
  writeFileSync(join(dir, 'members.sanitized.json'), JSON.stringify([
    { legacyMemberKey: 'a'.repeat(64), legacyMssv: '1', displayName: 'A', faculty: 'Y', legacyPosition: 'Chủ nhiệm', systemRole: 'admin', accountType: 'member', verificationStatus: 'not_required', claimStatus: 'unclaimed' },
  ]));
  writeFileSync(join(dir, 'activities.json'), JSON.stringify([
    { id: 'ACT-1', title: 'Hoạt động', eventDate: '2026-08-31', category: 'Học thuật', points: 10, summary: 'Tóm tắt', content: 'Nội dung', sourceDocumentFileId: 'doc', sourceImageFileId: 'img', status: 'published' },
  ]));

  const output = execFileSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/import-firestore.mjs', '--dry-run', '--dir', dir],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  assert.match(output, /MIGRATION_DRY_RUN=PASS/);
  assert.match(output, /members=1/);
  assert.match(output, /activities=1/);
});

test('migration activity accepts missing optional Drive source IDs', () => {
  const activity = normalizeMigrationActivity({
    id: 'ACT-2', title: 'Hoạt động không có tệp', eventDate: '2026-08-31',
    category: 'Học thuật', points: 0, summary: 'Tóm tắt', content: 'Nội dung',
    sourceDocumentFileId: '', sourceImageFileId: '', status: 'published',
  });
  assert.equal(activity.sourceDocumentFileId, '');
  assert.equal(activity.sourceImageFileId, '');
});
