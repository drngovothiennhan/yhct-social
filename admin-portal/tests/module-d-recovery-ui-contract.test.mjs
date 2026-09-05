import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const shell = await readFile(new URL('../app/acc-shell.tsx', import.meta.url), 'utf8').catch(() => '');
const page = await readFile(new URL('../app/recovery/page.tsx', import.meta.url), 'utf8').catch(() => '');
const center = await readFile(new URL('../app/components/recovery-control-center.tsx', import.meta.url), 'utf8').catch(() => '');

test('ACC shell exposes recovery while preserving existing control destinations', () => {
  for (const destination of ['/members', '/moderation', '/verification', '/ai', '/audit', '/system', '/recovery']) {
    assert.match(shell, new RegExp(destination.replace('/', '\\/')));
  }
  assert.match(shell, /YHCT Social · Beta 2\.0/);
});

test('recovery page remains behind AuthGate and AccShell', () => {
  assert.match(page, /AuthGate/);
  assert.match(page, /AccShell/);
  assert.match(page, /RecoveryControlCenter/);
});

test('recovery control center uses only brokered recovery APIs and includes required workflows', () => {
  assert.match(center, /accApi/);
  for (const endpoint of [
    '/api/recovery/state',
    '/api/recovery/backups',
    '/api/recovery/checkpoints',
    '/api/recovery/manifests',
    '/api/recovery/restores',
    '/api/recovery/imports',
  ]) assert.match(center, new RegExp(endpoint.replaceAll('/', '\\/')));

  for (const label of ['Safe Mode', 'Sao lưu', 'Checkpoint', 'Khôi phục', 'Xác minh', 'Từ chối']) {
    assert.match(center, new RegExp(label, 'i'));
  }
  assert.match(center, /production cutover.*không.*tự động|chuyển production.*không.*tự động/i);
  assert.doesNotMatch(center, /gs:\/\/|providerResourceRef|storagePrefix|serviceAccount|privateKey/i);
});

test('recovery mutations are visually admin-gated and duplicate submissions are guarded', () => {
  assert.match(center, /role === ['"]admin['"]/);
  assert.match(center, /busy|pending|inFlight/);
  assert.match(center, /disabled=/);
});
