import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../scripts/provision-members.mjs', import.meta.url), 'utf8');

test('real provisioning maintains a server-only idempotency ledger', () => {
  assert.match(source, /collection\('clubProvisioning'\)\.doc\(member\.memberCode\)/);
  assert.match(source, /buildProvisioningSourceHash\(member\)/);
  assert.match(source, /sourceHash/);
  assert.match(source, /uid:\s*user\.uid/);
});
