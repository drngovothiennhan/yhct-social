import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

test('recovery state route is admin-only for mutations and sanitized', () => {
  const source = read('app/api/recovery/state/route.ts');
  assert.match(source, /requireAccRole\(request,\s*['"]admin['"]\)/);
  assert.match(source, /setRecoveryState/);
  assert.match(source, /accErrorResponse/);
  assert.doesNotMatch(source, /projectId|bucket|providerResource|serviceAccount|updatedBy|createdAt/);
});

test('recovery state service uses system recovery document, validated operation idempotency and audit', () => {
  const source = read('lib/recovery-state.ts');
  assert.match(source, /validateOperationId\(input\.operationId\)/);
  assert.match(source, /system\/recovery/);
  assert.match(source, /adminAudit\/\$\{operationId\}/);
  assert.match(source, /runTransaction/);
  assert.match(source, /buildAuditEvent/);
  assert.match(source, /RECOVERY_OPERATION_CONFLICT/);
});
