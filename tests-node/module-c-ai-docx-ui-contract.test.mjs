import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(path) { return fs.readFileSync(path, 'utf8'); }

test('DOCX draft UI calls AI draft route and cannot publish posts directly', () => {
  const source = read('components/portal/docx-post-draft.tsx');
  assert.match(source, /\/api\/ai\/document-to-post/);
  assert.match(source, /onDraft/);
  assert.doesNotMatch(source, /createSocialPost|post-service/);
});

test('social composer keeps canonical manual publish authority', () => {
  const source = read('components/portal/social-composer.tsx');
  assert.match(source, /createSocialPost/);
  assert.match(source, /DocxPostDraft/);
  assert.match(source, /setText/);
});
