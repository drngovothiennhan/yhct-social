import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const shellUrl = new URL('../components/portal/portal-shell.tsx', import.meta.url);
const repairScriptUrl = new URL('../scripts/reset-admin-access.mjs', import.meta.url);
const repairWorkflowUrl = new URL('../.github/workflows/repair-beta2-admin-access.yml', import.meta.url);

async function textOrEmpty(url) {
  try {
    return await readFile(url, 'utf8');
  } catch {
    return '';
  }
}

test('guest member login is visible below xl breakpoints', async () => {
  const shell = await readFile(shellUrl, 'utf8');
  assert.match(shell, /!user/);
  assert.match(shell, /xl:hidden/);
  assert.match(shell, /<AuthCard\s*\/>/);
});

test('admin repair is fixed to one account and never logs the generated password', async () => {
  const source = await textOrEmpty(repairScriptUrl);
  assert.notEqual(source, '', 'missing single-account admin repair script');
  assert.match(source, /2413120084@members\.yhct\.hiu\.vn/);
  assert.match(source, /generateActivationPassword/);
  assert.match(source, /mustChangePassword:\s*true/);
  assert.match(source, /role:\s*'admin'/);
  assert.doesNotMatch(source, /console\.log\([^\n]*activationPassword/);
  assert.doesNotMatch(source, /process\.argv[^\n]*(member|email)/i);
});

test('admin repair workflow is isolated from main and stores credential in private Drive', async () => {
  const workflow = await textOrEmpty(repairWorkflowUrl);
  assert.notEqual(workflow, '', 'missing isolated admin repair workflow');
  assert.match(workflow, /branches:\s*\[fix\/rc-auth-access\]/);
  assert.doesNotMatch(workflow, /branches:\s*\[[^\]]*main/);
  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /YHCT_BETA2_PRIVATE_ACTIVATION|1ZZY7SaKQktjiGmDd1aZoE4hFwJYdKFrA/);
  assert.match(workflow, /reset-admin-access\.mjs/);
  assert.doesNotMatch(workflow, /echo[^\n]*(password|activationPassword)/i);
});
