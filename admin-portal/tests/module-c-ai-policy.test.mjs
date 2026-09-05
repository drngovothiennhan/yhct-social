import assert from 'node:assert/strict';
import test from 'node:test';
import { canDeleteAiKnowledge, canSyncAiKnowledge } from '../lib/ai-policy.ts';

test('AI knowledge sync follows ACC role hierarchy', () => {
  assert.equal(canSyncAiKnowledge('member'), false);
  assert.equal(canSyncAiKnowledge('mod'), true);
  assert.equal(canSyncAiKnowledge('super_mod'), true);
  assert.equal(canSyncAiKnowledge('admin'), true);

  assert.equal(canDeleteAiKnowledge('member'), false);
  assert.equal(canDeleteAiKnowledge('mod'), false);
  assert.equal(canDeleteAiKnowledge('super_mod'), true);
  assert.equal(canDeleteAiKnowledge('admin'), true);
});
