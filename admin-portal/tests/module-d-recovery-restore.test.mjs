import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { deriveRecoveryDatabaseId, assertRecoveryTarget } from '../lib/recovery-restore.ts';

test('recovery database target is server-derived and never live production', () => {
  const id = deriveRecoveryDatabaseId('operation-ABC_123', new Date('2026-09-05T03:04:00Z'));
  assert.match(id, /^recovery-20260905-0304-/);
  assert.notEqual(id, '(default)');
  assert.doesNotThrow(() => assertRecoveryTarget(id, '(default)'));
  assert.throws(() => assertRecoveryTarget('(default)', '(default)'), /RECOVERY_TARGET_INVALID/);
  assert.throws(() => assertRecoveryTarget('prod-main', 'prod-main'), /RECOVERY_TARGET_INVALID/);
  assert.throws(() => assertRecoveryTarget('arbitrary-db', '(default)'), /RECOVERY_TARGET_INVALID/);
});

test('restore and import routes are admin-only and do not accept destination or arbitrary storage URI', () => {
  for (const file of ['app/api/recovery/restores/route.ts', 'app/api/recovery/imports/route.ts']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /requireAccRole\(request,\s*['"]admin['"]\)/);
    assert.doesNotMatch(source, /body\.(?:recoveryDatabaseId|databaseId|projectId|bucket|inputUriPrefix|storagePrefix)/);
  }
  assert.match(fs.readFileSync('lib/recovery-restore.ts', 'utf8'), /startManagedBackupRestore/);
  assert.match(fs.readFileSync('lib/recovery-restore.ts', 'utf8'), /startImportToRecoveryDatabase/);
  assert.doesNotMatch(fs.readFileSync('lib/recovery-restore.ts', 'utf8'), /cutover|switchProduction|NEXT_PUBLIC_FIREBASE_PROJECT_ID\s*=/i);
});
