import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rules = await readFile(new URL('../storage.rules', import.meta.url), 'utf8');

test('social uploads require club member claim and completed password rotation', () => {
  assert.match(rules, /function canUploadSocial\(\)/);
  assert.match(rules, /request\.auth\.token\.clubMember == true/);
  assert.match(rules, /request\.auth\.token\.mustChangePassword != true/);
});

test('Module B post media uses canonical owner subtree', () => {
  assert.match(rules, /match \/social\/posts\/\{uid\}\/\{postId\}\/\{fileName\}/);
  assert.match(rules, /request\.auth\.uid == uid/);
});

test('Module B media is image-only and limited to ten MiB', () => {
  assert.match(rules, /contentType\.matches\('image\/\(jpeg\|png\|webp\)'\)/);
  assert.match(rules, /request\.resource\.size <= 10 \* 1024 \* 1024/);
});

test('Module C tightens certificate direct reads to the owner', () => {
  const certificateBlock = rules.match(/match \/certificates\/\{uid\}\/\{fileName\} \{([\s\S]*?)\n    \}/)?.[1] ?? '';
  assert.match(certificateBlock, /allow read: if signedIn\(\) && request\.auth\.uid == uid;/);
  assert.doesNotMatch(certificateBlock, /allow read:[^;]*isModerator\(\)/);
});
