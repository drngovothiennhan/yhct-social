import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../firestore.indexes.json', import.meta.url), 'utf8'));

test('Firestore composite index config excludes single-field indexes rejected by the API', () => {
  const invalid = (config.indexes ?? []).filter((index) => (index.fields ?? []).length < 2);
  assert.deepEqual(invalid, []);
});
