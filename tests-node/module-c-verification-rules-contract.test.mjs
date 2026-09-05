import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');

test('verification requests are owner-scoped pending-only client records', () => {
  assert.match(rules, /match \/verificationRequests\/\{uid\}/);
  assert.match(rules, /request\.auth\.uid == uid/);
  assert.match(rules, /status == 'pending'/);
  assert.match(rules, /decisionBy == null/);
  assert.match(rules, /decisionAt == null/);
  assert.match(rules, /decisionReason == null/);
});

test('verification decisions remain server-only', () => {
  const block = rules.match(/match \/verificationRequests\/\{uid\} \{([\s\S]*?)\n    \}/)?.[1] ?? '';
  assert.doesNotMatch(block, /isModerator\(\).*allow update/s);
  assert.doesNotMatch(block, /verified.*request\.resource|rejected.*request\.resource/s);
  assert.match(block, /allow delete: if false/);
});
