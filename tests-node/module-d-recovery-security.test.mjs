import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('recovery control documents remain behind Firestore authoritative default deny', () => {
  const rules = read('firestore.rules');
  assert.match(rules, /match\s+\/\{document=\*\*\}\s*\{[\s\S]*?allow\s+read\s*,\s*write\s*:\s*if\s+false\s*;/);
  assert.doesNotMatch(rules, /match\s+\/system\/recovery\b/);
  assert.doesNotMatch(rules, /match\s+\/recoveryManifests\b/);
});

test('Module D browser surfaces never receive provider or storage authority', () => {
  const files = [
    'components/portal/recovery-banner.tsx',
    'app/api/recovery/status/route.ts',
    'admin-portal/app/components/recovery-control-center.tsx',
  ];
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /gs:\/\/|providerResourceRef|storagePrefix|privateKey|private_key|refreshToken|refresh_token/i, file);
  }
});

test('Module D recovery production source contains no long-lived credential fallback or automatic production cutover', () => {
  const files = [
    'lib/server/recovery-public.ts',
    'admin-portal/lib/recovery-provider.ts',
    'admin-portal/lib/recovery-manifests.ts',
    'admin-portal/lib/recovery-restore.ts',
    'admin-portal/lib/recovery-validation.ts',
    'admin-portal/lib/recovery-state.ts',
  ];
  const combined = files.map(read).join('\n');
  assert.doesNotMatch(combined, /FIREBASE_TOKEN|service[_-]?account[^\n]{0,40}(json|key)|BEGIN PRIVATE KEY|refresh[_-]?token/i);
  assert.doesNotMatch(combined, /auto(?:matic)?[-_ ]?(?:cutover|promot)|cutoverProduction|switchProduction|promoteProduction/i);
});
