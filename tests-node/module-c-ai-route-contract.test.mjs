import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('Gemini SDK is instantiated only in the server adapter', () => {
  const adapter = read('lib/server/ai/gemini.ts');
  const analysis = read('lib/server/ai/analysis.ts');
  assert.match(adapter, /GoogleGenAI/);
  assert.doesNotMatch(analysis, /new\s+GoogleGenAI|from\s+['"]@google\/genai['"]/);
});

test('post analysis route verifies bearer auth and never imports moderation mutations', () => {
  const route = read('app/api/ai/analyze-post/route.ts');
  assert.match(route, /requireAiUser/);
  assert.match(route, /PostAnalysisInputSchema/);
  assert.match(route, /analyzePost/);
  assert.doesNotMatch(route, /moderation.*action|hidePost|softDelete|suspendUser/i);
  assert.match(route, /429|AI_QUOTA_EXCEEDED/);
});
