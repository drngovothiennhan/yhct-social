import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const exists = (path) => fs.existsSync(path);

test('Beta 1.3 privileged domains are server enforced', () => {
  for (const path of [
    'app/api/scoring/transaction/route.ts',
    'app/api/scoring/undo/route.ts',
    'app/api/governance/roles/route.ts',
    'app/api/recognition/approve/route.ts',
    'lib/server/privileged-auth.ts',
  ]) assert.ok(exists(path), `${path} must exist`);

  const auth = read('lib/server/privileged-auth.ts');
  assert.match(auth, /verifyIdToken/);
  assert.match(auth, /rootAdminDb/);
  assert.match(auth, /FORBIDDEN/);
});

test('Firestore rules cover Beta 1.3 domains and immutable ledgers', () => {
  const rules = read('firestore.rules');
  for (const marker of [
    'scoreTransactions',
    'auditLogs',
    'roleAssignments',
    'recognitions',
    'questions',
    'registrations',
    'sameDepartment',
  ]) assert.ok(rules.includes(marker), `firestore.rules missing ${marker}`);

  assert.match(rules, /match \/scoreTransactions\/\{transactionId\}[\s\S]*?allow update, delete: if false;/);
  assert.match(rules, /match \/auditLogs\/\{auditId\}[\s\S]*?allow update, delete: if false;/);
});

test('activity registration and community Q&A use Firebase-backed services', () => {
  for (const path of [
    'lib/activity-registration-service.ts',
    'lib/community-service.ts',
    'lib/recognition-service.ts',
  ]) assert.ok(exists(path), `${path} must exist`);

  const activity = read('lib/activity-registration-service.ts');
  assert.match(activity, /runTransaction/);
  assert.match(activity, /registrations/);
  assert.doesNotMatch(activity, /localStorage/);

  const community = read('lib/community-service.ts');
  assert.match(community, /questions/);
  assert.doesNotMatch(community, /localStorage/);
});

test('authoritative auth and data services do not use browser localStorage', () => {
  const critical = [
    'lib/auth-service.ts',
    'components/providers/auth-provider.tsx',
    'lib/member-service.ts',
    'lib/post-service.ts',
    'lib/reaction-service.ts',
    'lib/activity-service.ts',
  ];
  for (const path of critical) {
    assert.doesNotMatch(read(path), /localStorage/, `${path} must not use localStorage authority`);
  }
});

test('source tree has no Beta 1.2 overlay deployment markers', () => {
  const files = ['app/layout.tsx', 'app/page.tsx', 'next.config.ts'];
  const source = files.map(read).join('\n');
  for (const marker of ['p0.txt', 'd0.txt', 'hiu-yhct-social-beta1-2-0', 'eval(']) {
    assert.ok(!source.includes(marker), `source contains forbidden overlay marker ${marker}`);
  }
});
