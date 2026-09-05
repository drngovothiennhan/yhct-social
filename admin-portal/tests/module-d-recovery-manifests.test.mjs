import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildCheckpointRequest, sanitizeManifest, clampRecoveryLimit } from '../lib/recovery-manifests.ts';

test('checkpoint request accepts only server-authorized logical inputs', () => {
  assert.deepEqual(buildCheckpointRequest({
    operationId: ' op-1 ', reason: ' before release ', sourceReleaseSha: 'abcdef1234567', collectionIds: ['posts', 'users'],
  }), {
    operationId: 'op-1', reason: 'before release', sourceReleaseSha: 'abcdef1234567', collectionIds: ['posts', 'users'],
  });
  assert.throws(() => buildCheckpointRequest({ operationId: '', reason: 'x', sourceReleaseSha: 'abcdef1' }), /RECOVERY_OPERATION/);
  assert.throws(() => buildCheckpointRequest({ operationId: 'op', reason: '', sourceReleaseSha: 'abcdef1' }), /RECOVERY_REASON/);
});

test('manifest sanitizer removes provider and storage authority', () => {
  const dto = sanitizeManifest({
    manifestId: 'm1', operationId: 'op1', kind: 'export_checkpoint', sourceReleaseSha: 'abcdef1', status: 'running',
    providerResourceRef: 'projects/p/databases/x/operations/secret-op', storagePrefix: 'gs://private/prefix', requestedAt: 'now', failureCode: null,
  });
  assert.deepEqual(dto, { manifestId: 'm1', operationId: 'op1', kind: 'export_checkpoint', sourceReleaseSha: 'abcdef1', status: 'running', requestedAt: 'now', failureCode: null });
  assert.equal('providerResourceRef' in dto, false);
  assert.equal('storagePrefix' in dto, false);
});

test('recovery list limit is bounded to 50', () => {
  assert.equal(clampRecoveryLimit(undefined), 20);
  assert.equal(clampRecoveryLimit(1), 1);
  assert.equal(clampRecoveryLimit(500), 50);
});

test('recovery checkpoint and inventory routes are admin-only and do not accept provider authority', () => {
  for (const file of ['app/api/recovery/backups/route.ts', 'app/api/recovery/checkpoints/route.ts', 'app/api/recovery/manifests/route.ts']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /requireAccRole\(request,\s*['"]admin['"]\)/);
    assert.doesNotMatch(source, /body\.(?:bucket|projectId|databaseId|storagePrefix|providerResourceRef|serviceAccount)/);
  }
  const checkpoint = fs.readFileSync('app/api/recovery/checkpoints/route.ts', 'utf8');
  assert.match(checkpoint, /createExportCheckpoint/);
  assert.match(checkpoint, /sourceReleaseSha/);
});

test('manifest service keeps provider operation identity server-side and rejects conflicting operation reuse', () => {
  const source = fs.readFileSync('lib/recovery-manifests.ts', 'utf8');
  assert.match(source, /recoveryManifests/);
  assert.match(source, /adminAudit\/\$\{request\.operationId\}|adminAudit\/\$\{operationId\}/);
  assert.match(source, /RECOVERY_OPERATION_CONFLICT/);
  assert.match(source, /providerResourceRef/);
  assert.match(source, /startExportCheckpoint/);
});
