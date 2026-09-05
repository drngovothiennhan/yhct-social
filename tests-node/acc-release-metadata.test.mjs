import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const layout = fs.readFileSync(new URL('../admin-portal/app/layout.tsx', import.meta.url), 'utf8');

test('ACC production metadata identifies the official v2.0 release without beta labeling', () => {
  assert.match(layout, /YHCT Social · Admin Control Center/);
  assert.doesNotMatch(layout, /Beta 2\.0/i);
  assert.match(layout, /YHCT Social v2\.0/);
});
