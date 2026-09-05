import assert from 'node:assert/strict';
import test from 'node:test';
import { decideQuotaCounts, makeAiCacheKey, makeQuotaWindowKey } from '../lib/server/ai/quota.ts';

test('AI cache key is deterministic across identical inputs', () => {
  const a = makeAiCacheKey('analyze_post', 'abc123', 'gemini-fast');
  const b = makeAiCacheKey('analyze_post', 'abc123', 'gemini-fast');
  const c = makeAiCacheKey('analyze_post', 'different', 'gemini-fast');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[a-f0-9]{64}$/);
});

test('quota decision rejects per-user and daily ceilings before provider work', () => {
  assert.deepEqual(decideQuotaCounts({ userCount: 10, dailyCount: 20, perUserLimit: 10, dailyLimit: 200 }), {
    allowed: false,
    reason: 'user_window',
  });
  assert.deepEqual(decideQuotaCounts({ userCount: 1, dailyCount: 200, perUserLimit: 10, dailyLimit: 200 }), {
    allowed: false,
    reason: 'daily_global',
  });
  assert.deepEqual(decideQuotaCounts({ userCount: 2, dailyCount: 20, perUserLimit: 10, dailyLimit: 200 }), {
    allowed: true,
    remaining: 7,
  });
});

test('quota time window key is deterministic UTC hour bucket', () => {
  assert.equal(makeQuotaWindowKey(new Date('2026-09-05T00:59:59.000Z')), '2026-09-05T00');
  assert.equal(makeQuotaWindowKey(new Date('2026-09-05T01:00:00.000Z')), '2026-09-05T01');
});
