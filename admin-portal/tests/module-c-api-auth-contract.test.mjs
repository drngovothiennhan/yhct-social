import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const paths = [
  '../app/api/moderation/reports/route.ts',
  '../app/api/moderation/actions/route.ts',
  '../app/api/audit/route.ts',
];
const sources = await Promise.all(paths.map((path) => readFile(new URL(path, import.meta.url), 'utf8').catch(() => '')));

test('every Module C privileged route uses requireAccRole and sanitized errors', () => {
  for (const source of sources) {
    assert.match(source, /requireAccRole/);
    assert.match(source, /accErrorResponse/);
  }
});

test('moderation actions require operationId and trusted audit creation', () => {
  assert.match(sources[1], /operationId/);
  assert.match(sources[1], /resolveReportTransaction|restoreContentTransaction/);
});

test('full audit endpoint is admin-only and bounded', () => {
  assert.match(sources[2], /requireAccRole\(request, 'admin'\)/);
  assert.match(sources[2], /limit\(/);
});
