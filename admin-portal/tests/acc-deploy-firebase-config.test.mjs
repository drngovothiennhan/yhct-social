import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workflow = fs.readFileSync('../.github/workflows/deploy-admin-portal.yml', 'utf8');

test('ACC deploy acquires Firebase web config through keyless WIF', () => {
  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /google-github-actions\/auth@v3/);
  assert.match(workflow, /apps:sdkconfig WEB/);
  assert.match(workflow, /NEXT_PUBLIC_FIREBASE_API_KEY/);
  assert.match(workflow, /NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN/);
  assert.match(workflow, /NEXT_PUBLIC_FIREBASE_PROJECT_ID/);
  assert.match(workflow, /NEXT_PUBLIC_FIREBASE_APP_ID/);
});

test('ACC Firebase web config is persisted to Vercel production before deploy', () => {
  assert.match(workflow, /vercel env add/);
  assert.match(workflow, /production/);
  assert.match(workflow, /Firebase Web config/);
});
