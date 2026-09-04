import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dialog = await readFile(new URL('../components/portal/report-dialog.tsx', import.meta.url), 'utf8').catch(() => '');
const postCard = await readFile(new URL('../components/portal/social-post-card.tsx', import.meta.url), 'utf8');
const comments = await readFile(new URL('../components/portal/social-comments.tsx', import.meta.url), 'utf8');

test('post and comment surfaces expose the shared report dialog', () => {
  assert.match(postCard, /ReportDialog/);
  assert.match(comments, /ReportDialog/);
});

test('report dialog enforces fixed reason choices and 2000-character details', () => {
  assert.match(dialog, /2000/);
  assert.match(dialog, /spam/);
  assert.match(dialog, /misinformation/);
  assert.match(dialog, /inappropriate/);
  assert.match(dialog, /privacy/);
  assert.match(dialog, /other/);
});

test('report dialog handles deterministic duplicate reports safely', () => {
  assert.match(dialog, /already-exists/);
  assert.match(dialog, /Đã báo cáo nội dung này/);
});
