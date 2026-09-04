import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../next.config.mjs', import.meta.url), 'utf8');

test('ACC keeps firebase-admin outside the Next server bundle', () => {
  assert.match(source, /serverExternalPackages\s*:\s*\[[^\]]*['"]firebase-admin['"]/s);
});
