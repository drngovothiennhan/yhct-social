import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzePostWithDeps } from '../lib/server/ai/analysis.ts';

const actor = { uid: 'u1', role: 'member', clubMember: true, mustChangePassword: false };

test('advisory analysis uses injected provider, persists validated result, and reuses deterministic cache', async () => {
  let providerCalls = 0;
  const records = new Map();
  const deps = {
    modelVersion: 'gemini-test',
    consumeQuota: async () => ({ allowed: true, remaining: 9 }),
    read: async (id) => records.get(id) ?? null,
    write: async (id, value) => records.set(id, value),
    provider: {
      async generateStructured() {
        providerCalls += 1;
        return {
          category: 'clinical',
          confidence: 0.92,
          safetySignals: ['harassment'],
          rationale: 'Cần moderator xem lại ngôn từ.',
        };
      },
    },
  };

  const first = await analyzePostWithDeps({ targetType: 'draft', text: 'Trao đổi học thuật về chứng đau đầu.', clinicalCase: false }, actor, deps);
  const second = await analyzePostWithDeps({ targetType: 'draft', text: 'Trao đổi học thuật về chứng đau đầu.', clinicalCase: false }, actor, deps);

  assert.equal(first.category, 'clinical');
  assert.equal(first.cacheHit, false);
  assert.equal(second.cacheHit, true);
  assert.equal(providerCalls, 1);
  assert.equal(records.size, 1);
});

test('quota rejection happens before provider invocation', async () => {
  let providerCalled = false;
  await assert.rejects(
    analyzePostWithDeps(
      { targetType: 'draft', text: 'Nội dung học thuật an toàn.', clinicalCase: false },
      actor,
      {
        modelVersion: 'gemini-test',
        consumeQuota: async () => ({ allowed: false, reason: 'user_window' }),
        read: async () => null,
        write: async () => {},
        provider: { async generateStructured() { providerCalled = true; return {}; } },
      },
    ),
    /AI_QUOTA_EXCEEDED/,
  );
  assert.equal(providerCalled, false);
});
