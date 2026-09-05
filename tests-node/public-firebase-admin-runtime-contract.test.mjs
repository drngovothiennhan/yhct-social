import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('public runtime pins jwks-rsa to the known CJS-compatible boundary used by ACC', () => {
  assert.equal(packageJson.overrides?.['jwks-rsa'], '3.2.2');
});
