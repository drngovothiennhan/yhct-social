import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const indexes = JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf8')).indexes;

function hasIndex(collectionGroup, expectedFields) {
  return indexes.some((index) => index.collectionGroup === collectionGroup
    && expectedFields.every(({ fieldPath, order }) => index.fields.some((field) => field.fieldPath === fieldPath && field.order === order)));
}

test('community status feed has a bounded composite index', () => {
  assert.equal(hasIndex('questions', [
    { fieldPath: 'status', order: 'ASCENDING' },
    { fieldPath: 'updatedAt', order: 'DESCENDING' },
  ]), true);
});

test('member recognition history has its composite index', () => {
  assert.equal(hasIndex('recognitions', [
    { fieldPath: 'memberId', order: 'ASCENDING' },
    { fieldPath: 'status', order: 'ASCENDING' },
    { fieldPath: 'createdAt', order: 'DESCENDING' },
  ]), true);
});
