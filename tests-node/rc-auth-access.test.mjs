import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const shellUrl = new URL('../components/portal/portal-shell.tsx', import.meta.url);

test('guest member login is visible below xl breakpoints', async () => {
  const shell = await readFile(shellUrl, 'utf8');
  assert.match(shell, /!user/);
  assert.match(shell, /xl:hidden/);
  assert.match(shell, /<AuthCard\s*\/>/);
});
