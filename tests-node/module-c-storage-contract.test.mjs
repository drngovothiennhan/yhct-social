import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = readFileSync(new URL('../storage.rules', import.meta.url), 'utf8');

test('verification evidence reuses private certificates owner subtree', () => {
  assert.match(rules, /match \/certificates\/\{uid\}\/\{fileName\}/);
  assert.match(rules, /request\.auth\.uid == uid/);
  assert.match(rules, /isPdfOrImage\(\)/);
  assert.match(rules, /10 \* 1024 \* 1024/);
});

test('certificate evidence is never public-readable', () => {
  const certificateBlock = rules.match(/match \/certificates\/\{uid\}\/\{fileName\} \{([\s\S]*?)\n    \}/)?.[1] ?? '';
  assert.doesNotMatch(certificateBlock, /allow read: if true/);
  assert.match(certificateBlock, /request\.auth\.uid == uid/);
  assert.match(certificateBlock, /isModerator\(\)/);
});
