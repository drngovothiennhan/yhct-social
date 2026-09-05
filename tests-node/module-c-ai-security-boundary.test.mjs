import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const productionFiles = [
  '.env.example',
  'lib/server/ai/config.ts',
  'lib/server/ai/auth.ts',
  'lib/server/ai/gemini.ts',
  'lib/server/ai/privacy.ts',
  'lib/server/ai/quota.ts',
  'lib/server/ai/analysis.ts',
  'lib/server/ai/rag.ts',
  'lib/server/ai/docx.ts',
  'app/api/ai/analyze-post/route.ts',
  'app/api/ai/rag/internal/route.ts',
  'app/api/ai/rag/external/route.ts',
  'app/api/ai/document-to-post/route.ts',
  '.github/workflows/deploy-firebase-rules.yml',
].filter((path) => fs.existsSync(path));

const source = productionFiles.map((path) => `\n--- ${path} ---\n${fs.readFileSync(path, 'utf8')}`).join('\n');

test('Module C AI production boundary has no browser-exposed Gemini secrets or legacy credential fallback', () => {
  assert.doesNotMatch(source, /NEXT_PUBLIC_GEMINI/i);
  assert.doesNotMatch(source, /GCP_SERVICE_ACCOUNT_JSON|FIREBASE_TOKEN|credentials_json/i);
  assert.doesNotMatch(source, /BEGIN PRIVATE KEY|private_key_id/i);
});

test('Gemini SDK is confined to the server adapter and ACC knowledge control plane', () => {
  const rootFiles = productionFiles.filter((path) => path.startsWith('lib/server/ai/') || path.startsWith('app/api/ai/'));
  for (const path of rootFiles) {
    const text = fs.readFileSync(path, 'utf8');
    if (path === 'lib/server/ai/gemini.ts') continue;
    assert.doesNotMatch(text, /new\s+GoogleGenAI|from ['"]@google\/genai['"]/);
  }
});
