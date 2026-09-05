import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const productionFiles = [
  '../lib/domain/report.ts',
  '../lib/domain/verification-request.ts',
  '../lib/report-service.ts',
  '../lib/verification-service.ts',
  '../components/portal/report-dialog.tsx',
  '../components/portal/verification-panel.tsx',
  '../admin-portal/lib/module-c-policy.ts',
  '../admin-portal/lib/moderation.ts',
  '../admin-portal/lib/audit.ts',
  '../admin-portal/lib/verification.ts',
  '../admin-portal/lib/firebase-admin.ts',
  '../admin-portal/app/components/moderation-queue.tsx',
  '../admin-portal/app/components/verification-queue.tsx',
  '../admin-portal/app/components/audit-table.tsx',
  '../admin-portal/app/api/moderation/actions/route.ts',
  '../admin-portal/app/api/verification/requests/[uid]/route.ts',
  '../admin-portal/app/api/verification/requests/[uid]/evidence/route.ts',
  '../.github/workflows/deploy-firebase-rules.yml',
  '../firestore.rules',
  '../storage.rules',
];

const contents = await Promise.all(productionFiles.map(async (path) => ({
  path,
  source: await readFile(new URL(path, import.meta.url), 'utf8'),
})));

test('Module C production source has no unfinished markers or debug console logging', () => {
  for (const { path, source } of contents) {
    assert.doesNotMatch(source, /\b(?:TODO|TBD)\b/, `${path} contains unfinished marker`);
    assert.doesNotMatch(source, /console\.log\s*\(/, `${path} contains debug logging`);
  }
});

test('Module C production source has no legacy credential material', () => {
  for (const { path, source } of contents) {
    assert.doesNotMatch(source, /GCP_SERVICE_ACCOUNT_JSON|FIREBASE_TOKEN|"private_key"\s*:|"type"\s*:\s*"service_account"/, `${path} contains forbidden credential material`);
  }
});
