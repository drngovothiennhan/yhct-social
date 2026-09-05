import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { sanitizeValidationSummary } from '../lib/recovery-validation.ts';

test('recovery validation summary exposes only bounded operational metadata', () => {
  const summary = sanitizeValidationSummary({
    databaseReachable: true,
    schemaCompatible: false,
    criticalCollections: { users: 'present', system: 'missing', posts: 'unknown' },
    sampleChecksPassed: 4,
    sampleChecksFailed: 1,
    warnings: ['SCHEMA_VERSION_MISMATCH', 'x'.repeat(500)],
    validatedAt: '2026-09-05T03:00:00Z',
    rawDocument: { email: 'private@example.com' },
    providerBody: { token: 'secret' },
  });
  assert.equal(summary.databaseReachable, true);
  assert.equal(summary.schemaCompatible, false);
  assert.equal(summary.sampleChecksPassed, 4);
  assert.equal(summary.sampleChecksFailed, 1);
  assert.ok(summary.warnings.every((item) => item.length <= 160));
  assert.equal('rawDocument' in summary, false);
  assert.equal('providerBody' in summary, false);
});

test('validation and decision routes are admin-only and verified never performs production cutover', () => {
  for (const file of [
    'app/api/recovery/manifests/[manifestId]/validate/route.ts',
    'app/api/recovery/manifests/[manifestId]/decision/route.ts',
  ]) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /requireAccRole\(request,\s*['"]admin['"]\)/);
  }
  const decision = fs.readFileSync('app/api/recovery/manifests/[manifestId]/decision/route.ts', 'utf8');
  assert.match(decision, /verified|rejected/);
  assert.doesNotMatch(decision, /cutover|switchProduction|deploy|vercel/i);
});

test('validation service opens only server-derived recovery database and bounded critical markers', () => {
  const source = fs.readFileSync('lib/recovery-validation.ts', 'utf8');
  assert.match(source, /recovery-/);
  assert.match(source, /critical/i);
  assert.doesNotMatch(source, /collectionGroup|listCollections|while\s*\(|for\s+await/i);
});
