import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(file, 'utf8');

test('checkpoint import UI and route use the same manifestId field', () => {
  const ui = read('app/components/recovery-control-center.tsx');
  const route = read('app/api/recovery/imports/route.ts');
  assert.match(ui, /JSON\.stringify\(\{[^}]*manifestId[^}]*\}\)/s);
  assert.doesNotMatch(ui, /checkpointManifestId/);
  assert.match(route, /manifestId:\s*body\.manifestId/);
});

test('recovery state idempotency fingerprints mode and reason before replay', () => {
  const source = read('lib/recovery-state.ts');
  assert.match(source, /immutableFingerprint/);
  assert.match(source, /mode/);
  assert.match(source, /reason/);
  assert.match(source, /recorded\.immutableFingerprint\s*===\s*immutableFingerprint/);
  assert.match(source, /RECOVERY_OPERATION_CONFLICT/);
});

test('candidate validation is completed-only and audited with operationId', () => {
  const service = read('lib/recovery-validation.ts');
  const route = read('app/api/recovery/manifests/[manifestId]/validate/route.ts');
  const ui = read('app/components/recovery-control-center.tsx');

  assert.match(service, /String\(manifest\.status\s*\?\?\s*['"]['"]\)\s*!==\s*['"]completed['"]/);
  assert.match(service, /adminAudit\/\$\{operationId\}/);
  assert.match(service, /buildAuditEvent/);
  assert.match(service, /immutableFingerprint/);
  assert.match(route, /operationId:\s*body\.operationId/);
  assert.match(route, /reason:\s*body\.reason/);
  assert.match(route, /principal\.token\.uid/);
  assert.match(ui, /validateCandidate[\s\S]*operationId:\s*operationId\(['"]validate['"]\)/);
});
