import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../.github/workflows/provision-beta2-members.yml', import.meta.url), 'utf8');

test('idempotent provisioning never overwrites private activation credentials with a header-only CSV', () => {
  assert.match(source, /wc -l/);
  assert.match(source, /ACTIVATION_PRIVATE_STORE=SKIP_NO_NEW_CREDENTIALS/);
});
