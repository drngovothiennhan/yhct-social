import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const panel = await readFile(new URL('../components/portal/verification-panel.tsx', import.meta.url), 'utf8').catch(() => '');
const memberScreens = await readFile(new URL('../components/portal/member-screens.tsx', import.meta.url), 'utf8');

test('own profile verification panel exposes safe lifecycle and submission service', () => {
  assert.match(panel, /pending/);
  assert.match(panel, /rejected/);
  assert.match(panel, /uploadVerificationEvidence/);
  assert.match(panel, /submitVerificationRequest/);
  assert.match(panel, /10 MiB/);
  assert.doesNotMatch(panel, /downloadURL|getDownloadURL|resolveStorageUrl/);
});

test('member profile exposes only safe verification status and own profile mounts private controls', () => {
  assert.match(memberScreens, /verificationStatus/);
  assert.match(memberScreens, /VerificationPanel/);
  assert.doesNotMatch(memberScreens, /storagePath.*member|evidence.*member/i);
});
