import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const route = await readFile(new URL('../app/api/verification/requests/[uid]/evidence/route.ts', import.meta.url), 'utf8').catch(() => '');
const firebaseAdmin = await readFile(new URL('../lib/firebase-admin.ts', import.meta.url), 'utf8');
const queue = await readFile(new URL('../app/components/verification-queue.tsx', import.meta.url), 'utf8');

test('evidence access is brokered through a trusted super moderator route', () => {
  assert.match(route, /requireAccRole\(request, 'super_mod'\)/);
  assert.match(route, /verificationRequests/);
  assert.match(route, /storagePath/);
  assert.match(route, /Cache-Control.*no-store/s);
  assert.match(route, /adminBucket/);
});

test('admin storage bucket uses trusted Firebase Admin runtime', () => {
  assert.match(firebaseAdmin, /firebase-admin\/storage/);
  assert.match(firebaseAdmin, /adminBucket/);
});

test('verification queue opens evidence only through the ACC broker endpoint', () => {
  assert.match(queue, /evidence\?path=/);
  assert.match(queue, /Authorization/);
  assert.doesNotMatch(queue, /getDownloadURL/);
});
