import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const shell = await readFile(new URL('../app/acc-shell.tsx', import.meta.url), 'utf8').catch(() => '');
const authGate = await readFile(new URL('../app/auth-gate.tsx', import.meta.url), 'utf8').catch(() => '');
const page = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');

for (const destination of ['/members', '/moderation', '/verification', '/audit', '/system']) {
  test(`ACC shell exposes ${destination}`, () => assert.match(shell, new RegExp(destination.replace('/', '\\/'))));
}

test('auth gate retains password rotation and claim checks', () => {
  assert.match(authGate, /mustChangePassword/);
  assert.match(authGate, /clubMember/);
  assert.match(authGate, /mod.*super_mod.*admin/s);
});

test('ACC entry composes AuthGate and AccShell rather than mounting the old monolith directly', () => {
  assert.match(page, /AuthGate/);
  assert.match(page, /AccShell/);
});
