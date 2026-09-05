import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { sanitizePublicRecoveryState } from '../lib/server/recovery-public.ts';

test('public recovery state exposes only mode readOnly safe message and optional retry hint', () => {
  const dto = sanitizePublicRecoveryState({
    mode: 'safe_mode', readOnlyPublic: true, reason: 'private incident detail', activeOperationId: 'op-secret', updatedBy: 'admin-uid',
    providerResourceRef: 'projects/x/operations/y', storagePrefix: 'gs://private/path', retryAfterSeconds: 120,
  });
  assert.deepEqual(dto, { mode: 'safe_mode', readOnly: true, message: 'Hệ thống đang ở chế độ an toàn. Một số thao tác ghi tạm thời không khả dụng.', retryAfterSeconds: 120 });
  for (const key of ['reason', 'activeOperationId', 'updatedBy', 'providerResourceRef', 'storagePrefix']) assert.equal(key in dto, false);
});

test('normal and degraded public recovery copy is deterministic and bounded', () => {
  assert.deepEqual(sanitizePublicRecoveryState({ mode: 'normal', readOnlyPublic: false }), { mode: 'normal', readOnly: false, message: '' });
  const degraded = sanitizePublicRecoveryState({ mode: 'degraded', readOnlyPublic: false });
  assert.equal(degraded.mode, 'degraded');
  assert.equal(degraded.readOnly, false);
  assert.match(degraded.message, /hạn chế|giảm tải/i);
  assert.ok(degraded.message.length < 200);
});

test('public recovery status route and portal banner never expose internal recovery authority', () => {
  const route = fs.readFileSync('app/api/recovery/status/route.ts', 'utf8');
  assert.match(route, /getPublicRecoveryState/);
  assert.doesNotMatch(route, /reason|activeOperationId|storagePrefix|providerResource|backupId|updatedBy|serviceAccount/i);
  const banner = fs.readFileSync('components/portal/recovery-banner.tsx', 'utf8');
  assert.match(banner, /\/api\/recovery\/status/);
  assert.match(banner, /readOnly|mode/);
  assert.doesNotMatch(banner, /Firestore.*blocked|all writes.*blocked|mọi.*ghi.*khóa/i);
  const shell = fs.readFileSync('components/portal/portal-shell.tsx', 'utf8');
  assert.match(shell, /RecoveryBanner/);
});
