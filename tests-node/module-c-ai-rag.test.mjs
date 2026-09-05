import assert from 'node:assert/strict';
import test from 'node:test';
import { queryRagWithDeps } from '../lib/server/ai/rag.ts';

const actor = { uid: 'u1', role: 'member', clubMember: true, mustChangePassword: false };

function baseDeps(captured, response) {
  return {
    model: 'gemini-test',
    fileSearchStore: 'fileSearchStores/internal-only',
    consumeQuota: async () => ({ allowed: true, remaining: 9 }),
    generate: async (request) => { captured.push(request); return response; },
    resolveInternalSources: async (chunks) => chunks.map((chunk, index) => ({
      id: `internal-${index}`,
      title: chunk.title || 'Nguồn nội bộ',
    })),
  };
}

test('internal RAG uses File Search only and external RAG uses Google Search only', async () => {
  const internalCalls = [];
  await queryRagWithDeps('internal', { query: 'Khí huyết là gì?' }, actor, baseDeps(internalCalls, {
    text: 'Nội dung nội bộ',
    chunks: [{ kind: 'retrieved', title: 'Nội Kinh' }],
  }));
  assert.deepEqual(internalCalls[0].tools, [{ fileSearch: { fileSearchStoreNames: ['fileSearchStores/internal-only'] } }]);
  assert.equal(JSON.stringify(internalCalls[0]).includes('googleSearch'), false);

  const externalCalls = [];
  await queryRagWithDeps('external', { query: 'Nghiên cứu mới về châm cứu?' }, actor, baseDeps(externalCalls, {
    text: 'Nội dung bên ngoài',
    chunks: [{ kind: 'web', title: 'Journal', uri: 'https://example.org/article' }],
  }));
  assert.deepEqual(externalCalls[0].tools, [{ googleSearch: {} }]);
  assert.equal(JSON.stringify(externalCalls[0]).includes('fileSearchStoreNames'), false);
});

test('RAG never invents sources when provider returns no grounding', async () => {
  for (const mode of ['internal', 'external']) {
    const calls = [];
    const result = await queryRagWithDeps(mode, { query: 'Câu hỏi không có bằng chứng?' }, actor, baseDeps(calls, {
      text: 'Không tìm thấy bằng chứng phù hợp.',
      chunks: [],
    }));
    assert.equal(result.mode, mode);
    assert.equal(result.grounded, false);
    assert.equal(result.degraded, true);
    assert.deepEqual(result.sources, []);
  }
});

test('external RAG maps only provider web grounding metadata into safe sources', async () => {
  const calls = [];
  const result = await queryRagWithDeps('external', { query: 'Tổng quan y văn?' }, actor, baseDeps(calls, {
    text: 'Tổng hợp có nguồn.',
    chunks: [
      { kind: 'web', title: 'Source A', uri: 'https://example.org/a' },
      { kind: 'retrieved', title: 'Should not leak internal' },
    ],
  }));
  assert.equal(result.grounded, true);
  assert.deepEqual(result.sources, [{ id: 'https://example.org/a', title: 'Source A', uri: 'https://example.org/a' }]);
});
