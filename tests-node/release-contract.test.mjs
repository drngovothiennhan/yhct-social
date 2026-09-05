import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);
const accPackageJson = JSON.parse(
  await readFile(new URL('../admin-portal/package.json', import.meta.url), 'utf8'),
);

async function readProjectFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('release metadata is frozen at version 2.0.0', () => {
  assert.equal(packageJson.version, '2.0.0');
  assert.equal(accPackageJson.version, '2.0.0');
});

test('ACC shell identifies the official v2.0 release without beta labeling', async () => {
  const shell = await readProjectFile('admin-portal/app/acc-shell.tsx');
  assert.match(shell, /YHCT Social · v2\.0/);
  assert.doesNotMatch(shell, /Beta 2\.0/);
});

test('ACC production deploy is main-only and validates before deploying', async () => {
  const workflow = await readProjectFile('.github/workflows/deploy-admin-portal.yml');
  assert.match(workflow, /branches:\s*\[main\]/);
  assert.match(workflow, /if:\s*github\.ref == 'refs\/heads\/main'/);
  assert.doesNotMatch(workflow, /branches:\s*\[beta\/2\.0-module-a\]/);
  assert.match(workflow, /npm run check/);
  assert.match(workflow, /--prod/);
  assert.doesNotMatch(workflow, /FIREBASE_TOKEN|private_key|service_account\s*:/i);
});

test('modern app-web manifest exposes standalone install metadata', async () => {
  const manifest = await readProjectFile('app/manifest.ts');
  assert.match(manifest, /name:\s*['"]YHCT Social['"]/);
  assert.match(manifest, /short_name:\s*['"]YHCT Social['"]/);
  assert.match(manifest, /start_url:\s*['"]\/['"]/);
  assert.match(manifest, /display:\s*['"]standalone['"]/);
});

test('Capacitor Android shell is pinned to the canonical production app-web', async () => {
  const config = await readProjectFile('capacitor.config.ts');
  assert.match(config, /appId:\s*['"]vn\.hiu\.yhctsocial['"]/);
  assert.match(config, /appName:\s*['"]YHCT Social['"]/);
  assert.match(config, /url:\s*['"]https:\/\/yhct-social\.vercel\.app['"]/);
  assert.match(config, /cleartext:\s*false/);
  assert.equal(packageJson.dependencies['@capacitor/core'], '8.5.1');
  assert.equal(packageJson.devDependencies['@capacitor/android'], '8.5.1');
  assert.equal(packageJson.devDependencies['@capacitor/cli'], '8.5.1');
});

test('Android packaging workflow produces a checksum and APK artifact', async () => {
  const workflow = await readProjectFile('.github/workflows/build-android-apk.yml');
  assert.match(workflow, /assembleDebug/);
  assert.match(workflow, /sha256sum/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
});
