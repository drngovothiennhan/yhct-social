import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildProvisioningPlan,
  dedupeRosterRows,
  generateActivationPassword,
  mapTitleToRole,
  memberCodeToSyntheticEmail,
  normalizeMemberCode,
  parseRosterCsv,
} from '../lib/domain/provisioning.ts';

test('member code normalization keeps digits and rejects empty identifiers', () => {
  assert.equal(normalizeMemberCode(' 2413120001 '), '2413120001');
  assert.throws(() => normalizeMemberCode('   '), /MSSV/);
});

test('plain MSSV maps to the internal Firebase email alias', () => {
  assert.equal(memberCodeToSyntheticEmail('2413120001'), '2413120001@members.yhct.hiu.vn');
});

test('club titles map to the four-level Beta 2.0 role hierarchy', () => {
  assert.equal(mapTitleToRole('Chủ Nhiệm'), 'admin');
  assert.equal(mapTitleToRole('Phó Chủ Nhiệm'), 'super_mod');
  assert.equal(mapTitleToRole('Ban quản lý'), 'mod');
  assert.equal(mapTitleToRole('Thành viên'), 'member');
});

test('duplicate MSSV rows merge to highest privilege and preserve a conflict flag', () => {
  const rows = [
    { memberCode: '2413120001', displayName: 'Sinh Viên A', faculty: 'Y', title: 'Thành viên' },
    { memberCode: '2413120001', displayName: 'Sinh Vien A', faculty: 'Y', title: 'Ban quản lý' },
    { memberCode: '2413120002', displayName: 'Sinh Viên B', faculty: 'Y', title: 'Thành viên' },
  ];
  const result = dedupeRosterRows(rows);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    memberCode: '2413120001', displayName: 'Sinh Viên A', faculty: 'Y',
    title: 'Ban quản lý', role: 'mod', sourceConflict: true,
  });
});

test('activation password is random-looking and never derived from MSSV', () => {
  const password = generateActivationPassword();
  assert.equal(password.length >= 16, true);
  assert.match(password, /[A-Z]/);
  assert.match(password, /[a-z]/);
  assert.match(password, /[0-9]/);
  assert.notEqual(password, '2413120001');
});

test('CSV parser finds the MSSV header and excludes phone data from returned rows', () => {
  const csv = [
    'DANH SÁCH CLB,,,,,',
    'STT,Họ và tên,MSSV,Khoa,SĐT,Chức vụ',
    '1,"Sinh Viên A",2413120001,Y,0900000000,"Ban quản lý"',
  ].join('\n');
  assert.deepEqual(parseRosterCsv(csv), [{
    memberCode: '2413120001', displayName: 'Sinh Viên A', faculty: 'Y', title: 'Ban quản lý',
  }]);
});

test('provisioning plan is deterministic and never exposes an activation password in dry-run data', () => {
  const members = dedupeRosterRows([
    { memberCode: '2413120001', displayName: 'Sinh Viên A', faculty: 'Y', title: 'Thành viên' },
  ]);
  assert.deepEqual(buildProvisioningPlan(members), [{
    memberCode: '2413120001', syntheticEmail: '2413120001@members.yhct.hiu.vn',
    displayName: 'Sinh Viên A', faculty: 'Y', title: 'Thành viên', role: 'member', sourceConflict: false,
  }]);
});

test('provisioning CLI dry-run reports only aggregate counts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'yhct-provision-test-'));
  const source = join(dir, 'roster.csv');
  writeFileSync(source, [
    'STT,Họ và tên,MSSV,Khoa,SĐT,Chức vụ',
    '1,"Sinh Viên A",2413120001,Y,0900000000,"Ban quản lý"',
    '2,"Sinh Viên B",2413120002,Y,0911111111,"Thành viên"',
  ].join('\n'));
  const output = execFileSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/provision-members.mjs', '--file', source, '--dry-run'],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  assert.match(output, /PROVISION_DRY_RUN=PASS/);
  assert.match(output, /members=2/);
  assert.match(output, /mod=1/);
  assert.doesNotMatch(output, /Sinh Viên/);
  assert.doesNotMatch(output, /0900000000/);
  assert.doesNotMatch(output, /activationPassword/);
});
