import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../.github/workflows/provision-beta2-members.yml', import.meta.url), 'utf8');

test('Firestore permission probe uses a legal document ID', () => {
  assert.doesNotMatch(source, /__permission_probe__/);
  assert.match(source, /clubProvisioning\/permission-probe/);
});
