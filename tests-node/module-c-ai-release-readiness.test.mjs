import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(path) { return fs.readFileSync(path, 'utf8'); }

const productionDeploy = read('.github/workflows/deploy-firebase-rules.yml');
const releaseValidation = read('.github/workflows/deploy-beta2-firestore-rules.yml');
const ci = read('.github/workflows/ci.yml');

const moduleCProductionFiles = [
  'lib/server/ai/config.ts',
  'lib/server/ai/auth.ts',
  'lib/server/ai/types.ts',
  'lib/server/ai/privacy.ts',
  'lib/server/ai/quota.ts',
  'lib/server/ai/gemini.ts',
  'lib/server/ai/analysis.ts',
  'lib/server/ai/rag.ts',
  'lib/server/ai/docx.ts',
  'lib/hardware-mode.ts',
  'components/providers/hardware-mode-provider.tsx',
  'components/portal/hardware-mode-control.tsx',
  'components/portal/ai-research-panel.tsx',
  'components/portal/docx-post-draft.tsx',
  'components/portal/social-composer.tsx',
  'app/api/ai/analyze-post/route.ts',
  'app/api/ai/rag/internal/route.ts',
  'app/api/ai/rag/external/route.ts',
  'app/api/ai/document-to-post/route.ts',
  'admin-portal/lib/ai-policy.ts',
  'admin-portal/lib/ai-knowledge.ts',
  'admin-portal/lib/ai-ops.ts',
  'admin-portal/app/api/ai/health/route.ts',
  'admin-portal/app/api/ai/analyses/route.ts',
  'admin-portal/app/components/ai-control-center.tsx',
].filter((path) => fs.existsSync(path));

const productionSource = moduleCProductionFiles.map((path) => `\n--- ${path} ---\n${read(path)}`).join('\n');

test('production Firebase deployment remains main-only WIF-only', () => {
  assert.match(productionDeploy, /branches:\s*\[main\]/);
  assert.match(productionDeploy, /if:\s*github\.ref == 'refs\/heads\/main'/);
  assert.match(productionDeploy, /id-token:\s*write/);
  assert.match(productionDeploy, /workload_identity_provider:/);
  assert.doesNotMatch(productionDeploy, /credentials_json|GCP_SERVICE_ACCOUNT_JSON|FIREBASE_TOKEN/);
});

test('feature and release validation cannot authenticate as production deployer', () => {
  assert.doesNotMatch(ci, /id-token:\s*write|workload_identity_provider|google-github-actions\/auth/);
  assert.doesNotMatch(releaseValidation, /id-token:\s*write|workload_identity_provider|google-github-actions\/auth|GCP_WIF_PROVIDER/);
  assert.match(releaseValidation, /branches:\s*\[release\/v1\.0\]/);
});

test('Module C AI production source has no unfinished markers, debug logging, or credential material', () => {
  assert.doesNotMatch(productionSource, /\bTODO\b|\bTBD\b/);
  assert.doesNotMatch(productionSource, /console\.log\s*\(/);
  assert.doesNotMatch(productionSource, /NEXT_PUBLIC_GEMINI|GCP_SERVICE_ACCOUNT_JSON|FIREBASE_TOKEN|credentials_json/i);
  assert.doesNotMatch(productionSource, /BEGIN PRIVATE KEY|private_key_id/i);
});

test('Module C AI keeps advisory and manual-authority boundaries visible in production source', () => {
  assert.match(read('lib/server/ai/analysis.ts'), /Chỉ phân tích/);
  assert.doesNotMatch(read('lib/server/ai/analysis.ts'), /moderation\.ts|moderation-service|hidePost|deletePost/);
  assert.match(read('components/portal/docx-post-draft.tsx'), /không tự động được đăng/i);
  assert.match(read('components/portal/social-composer.tsx'), /createSocialPost/);
});
