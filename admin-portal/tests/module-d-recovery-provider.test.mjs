import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createRecoveryProviderWithDeps } from '../lib/recovery-provider.ts';

test('recovery provider normalizes backup inventory and does not expose full resource names', async () => {
  const provider = createRecoveryProviderWithDeps({
    projectId: 'demo-project',
    databaseId: '(default)',
    location: 'nam5',
    bucket: 'recovery-bucket',
    prefix: 'yhct-recovery',
    accessToken: async () => 'test-token',
    fetchJson: async () => ({ backups: [{ name: 'projects/demo-project/locations/nam5/backups/bkp-123', state: 'READY', database: 'projects/demo-project/databases/(default)', snapshotTime: '2026-09-05T00:00:00Z', expireTime: '2026-10-01T00:00:00Z' }] }),
  });
  const rows = await provider.listManagedBackups();
  assert.deepEqual(rows, [{ id: 'bkp-123', state: 'READY', databaseId: '(default)', snapshotTime: '2026-09-05T00:00:00Z', expireTime: '2026-10-01T00:00:00Z' }]);
});

test('export checkpoint destination is server-derived and operation output is sanitized', async () => {
  let request;
  const provider = createRecoveryProviderWithDeps({
    projectId: 'demo-project', databaseId: '(default)', location: 'nam5', bucket: 'recovery-bucket', prefix: 'yhct-recovery',
    accessToken: async () => 'test-token',
    fetchJson: async (path, init) => { request = { path, init }; return { name: 'projects/demo/operations/export-1', done: false, metadata: { secret: 'drop-me' } }; },
  });
  const result = await provider.startExportCheckpoint({ checkpointId: 'cp-123', collectionIds: ['posts'] });
  assert.equal(result.operationId, 'export-1');
  assert.equal(result.done, false);
  assert.match(request.path, /databases\/\(default\)\/exportDocuments$/);
  assert.equal(request.init.body.outputUriPrefix, 'gs://recovery-bucket/yhct-recovery/cp-123');
  assert.deepEqual(request.init.body.collectionIds, ['posts']);
  assert.equal('metadata' in result, false);
});

test('provider source has no long-lived credential or browser authority fallback', () => {
  const source = fs.readFileSync('lib/recovery-provider.ts', 'utf8');
  assert.doesNotMatch(source, /FIREBASE_TOKEN|PRIVATE KEY|private_key|refresh_token|GCP_SERVICE_ACCOUNT_JSON|NEXT_PUBLIC_.*RECOVERY|serviceAccountKey/i);
  assert.match(source, /ExternalAccountClient|GoogleAuth/);
  assert.match(source, /RECOVERY_GCP_LOCATION/);
  assert.match(source, /RECOVERY_EXPORT_BUCKET/);
});
