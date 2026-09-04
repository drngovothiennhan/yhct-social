import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const indexes = JSON.parse(readFileSync(new URL('../firestore.indexes.json', import.meta.url), 'utf8'));

test('reports are self-authored open records with moderator fields locked', () => {
  assert.match(rules, /match \/reports\/\{reportId\}/);
  assert.match(rules, /request\.resource\.data\.reporterUid == request\.auth\.uid/);
  assert.match(rules, /request\.resource\.data\.status == 'open'/);
  assert.match(rules, /details\.size\(\) <= 2000/);
  assert.match(rules, /allow update, delete: if false/);
});

test('admin audit is never client writable', () => {
  assert.match(rules, /match \/adminAudit\/\{eventId\}/);
  assert.match(rules, /allow write: if false/);
});

test('Module C report queue has bounded-query indexes', () => {
  const reportIndexes = indexes.indexes.filter((entry) => entry.collectionGroup === 'reports');
  assert.ok(reportIndexes.some((entry) => entry.fields.some((field) => field.fieldPath === 'status') && entry.fields.some((field) => field.fieldPath === 'createdAt' && field.order === 'ASCENDING')));
});
