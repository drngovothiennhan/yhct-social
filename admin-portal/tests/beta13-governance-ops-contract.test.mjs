import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8');

test('ACC exposes scoring and recognition destinations', () => {
  const shell = read('app/acc-shell.tsx');
  assert.match(shell, /\/scoring/);
  assert.match(shell, /\/recognition/);
  assert.equal(fs.existsSync('app/scoring/page.tsx'), true);
  assert.equal(fs.existsSync('app/recognition/page.tsx'), true);
});

test('ACC scoring mutations are server-side and auditable', () => {
  const create = read('app/api/scoring/transactions/route.ts');
  const undo = read('app/api/scoring/undo/route.ts');
  assert.match(create, /requireAccRole/);
  assert.match(create, /runTransaction/);
  assert.match(create, /scoreTransactions/);
  assert.match(create, /adminAudit/);
  assert.match(undo, /requireAccRole/);
  assert.match(undo, /runTransaction/);
  assert.match(undo, /reversedByTransactionId/);
});

test('ACC recognition approval is admin-only and never changes score directly', () => {
  const source = read('app/api/recognition/approve/route.ts');
  assert.match(source, /requireAccRole\(request, 'admin'\)/);
  assert.match(source, /recognitions/);
  assert.match(source, /adminAudit/);
  assert.doesNotMatch(source, /scoreTotal/);
});
