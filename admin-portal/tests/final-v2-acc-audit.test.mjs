import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync(new URL('../app/dashboard.tsx', import.meta.url), 'utf8');
const recovery = readFileSync(new URL('../app/components/recovery-control-center.tsx', import.meta.url), 'utf8');
const checkpoints = readFileSync(new URL('../app/api/recovery/checkpoints/route.ts', import.meta.url), 'utf8');
const restores = readFileSync(new URL('../app/api/recovery/restores/route.ts', import.meta.url), 'utf8');

test('member management UI mirrors server RBAC instead of showing dead actions', () => {
  assert.match(dashboard, /canSetRole/);
  assert.match(dashboard, /canEditClubTitle/);
  assert.match(dashboard, /canDisableAccount/);
  assert.match(dashboard, /canSetRole\(role, member\.role/);
  assert.match(dashboard, /canEditClubTitle\(role, member\.role\)/);
  assert.match(dashboard, /canDisableAccount\(role, member\.role\)/);
});

test('recovery UI does not hard-code an obsolete release SHA', () => {
  assert.doesNotMatch(recovery, /const RELEASE_SHA = ['"][0-9a-f]{40}['"]/);
  assert.doesNotMatch(recovery, /sourceReleaseSha: RELEASE_SHA/);
});

test('recovery mutations derive source release identity on the server', () => {
  assert.match(checkpoints, /currentReleaseSha/);
  assert.match(restores, /currentReleaseSha/);
  assert.doesNotMatch(checkpoints, /sourceReleaseSha: body\.sourceReleaseSha/);
  assert.doesNotMatch(restores, /sourceReleaseSha: body\.sourceReleaseSha/);
});
