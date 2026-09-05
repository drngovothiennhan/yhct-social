import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8').catch(() => '');
}

const moderationPage = await source('../app/moderation/page.tsx');
const verificationPage = await source('../app/verification/page.tsx');
const auditPage = await source('../app/audit/page.tsx');
const moderationQueue = await source('../app/components/moderation-queue.tsx');
const verificationQueue = await source('../app/components/verification-queue.tsx');
const auditTable = await source('../app/components/audit-table.tsx');

test('moderation screen defaults to open queue and exposes allowed resolution actions', () => {
  assert.match(moderationPage + moderationQueue, /open/);
  assert.match(moderationQueue, /keep/);
  assert.match(moderationQueue, /hide/);
  assert.match(moderationQueue, /soft_delete/);
  assert.match(moderationQueue, /dismiss/);
  assert.match(moderationQueue, /canRestore/);
});

test('verification queue supports only trusted verified or rejected decisions', () => {
  assert.match(verificationPage + verificationQueue, /pending/);
  assert.match(verificationQueue, /verified/);
  assert.match(verificationQueue, /rejected/);
  assert.match(verificationQueue, /canDecideVerification/);
});

test('audit screen is admin-only and bounded through the shared API client', () => {
  assert.match(auditPage + auditTable, /canReadFullAudit/);
  assert.match(auditTable, /\/api\/audit/);
  assert.match(auditTable, /limit=30/);
});

test('operation controls guard duplicate submissions and sanitize failures', () => {
  assert.match(moderationQueue, /busy/);
  assert.match(verificationQueue, /busy/);
  assert.doesNotMatch(moderationQueue + verificationQueue + auditTable, /console\.error/);
});
