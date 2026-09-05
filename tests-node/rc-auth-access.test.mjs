import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const shell = await readFile(new URL('../components/portal/portal-shell.tsx', import.meta.url), 'utf8');

test('guest member login is visible below xl breakpoints', () => {
  assert.match(shell, /!user/);
  assert.match(shell, /xl:hidden/);
  assert.match(shell, /<AuthCard\s*\/>/);
});
