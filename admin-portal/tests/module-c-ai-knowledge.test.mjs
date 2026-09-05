import assert from 'node:assert/strict';
import test from 'node:test';
import { syncKnowledgeSourceWithDeps } from '../lib/ai-knowledge.ts';

const actor = { uid: 'admin1', role: 'admin' };

test('knowledge sync is idempotent for an unchanged Drive version hash', async () => {
  let uploads = 0;
  const manifest = new Map([
    ['drive-file-1', { sourceId: 'drive-file-1', contentHash: 'same-hash', providerDocumentId: 'provider-1', status: 'ready' }],
  ]);
  const result = await syncKnowledgeSourceWithDeps(
    { driveFileId: 'drive-file-1', title: 'Nội Kinh', contentHash: 'same-hash' },
    actor,
    {
      readManifest: async (id) => manifest.get(id) ?? null,
      writeManifest: async (id, value) => manifest.set(id, value),
      uploadToFileSearch: async () => { uploads += 1; return { providerDocumentId: 'provider-new' }; },
    },
  );
  assert.equal(result.status, 'unchanged');
  assert.equal(uploads, 0);
});

test('changed source uploads once and persists provider reference without credentials', async () => {
  let writes = 0;
  const stored = [];
  const result = await syncKnowledgeSourceWithDeps(
    { driveFileId: 'drive-file-2', title: 'Thương Hàn Luận', contentHash: 'new-hash' },
    actor,
    {
      readManifest: async () => null,
      writeManifest: async (_id, value) => { writes += 1; stored.push(value); },
      uploadToFileSearch: async () => ({ providerDocumentId: 'provider-2' }),
    },
  );
  assert.equal(result.status, 'synced');
  assert.equal(writes, 1);
  assert.equal(stored[0].providerDocumentId, 'provider-2');
  assert.equal('accessToken' in stored[0], false);
  assert.equal('credentials' in stored[0], false);
});
