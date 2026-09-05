import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('production Firebase deploy remains main-only on the approved WIF provider', () => {
  const workflow = read('.github/workflows/deploy-firebase-rules.yml');
  assert.match(workflow, /branches:\s*\[main\]/);
  assert.match(workflow, /if:\s*github\.ref\s*==\s*['"]refs\/heads\/main['"]/);
  assert.match(workflow, /projects\/244889451934\/locations\/global\/workloadIdentityPools\/github-yhct-social\/providers\/github-main/);
  assert.match(workflow, /yhct-github-deploy@yhct-social-260902-42a4\.iam\.gserviceaccount\.com/);
  assert.doesNotMatch(workflow, /branches:\s*\[[^\]]*(release\/v1\.0|beta\/2\.0-module-d-recovery)/);
});

test('feature recovery work does not introduce a production deployment workflow', () => {
  const workflowDir = path.join(root, '.github', 'workflows');
  const workflows = fs.readdirSync(workflowDir).filter((name) => /recovery|backup/i.test(name));
  assert.deepEqual(workflows, []);
});

test('README documents Module D isolation, recovery database validation, and no automatic cutover', () => {
  const readme = read('README.md');
  assert.match(readme, /Module D[^\n]*Backup[^\n]*Recovery/i);
  assert.match(readme, /recovery database/i);
  assert.match(readme, /production cutover[^\n]*(không|not)[^\n]*(tự động|automatic)/i);
  assert.match(readme, /main-only|chỉ[^\n]*main/i);
  assert.match(readme, /OIDC\/WIF|WIF-only/i);
});
