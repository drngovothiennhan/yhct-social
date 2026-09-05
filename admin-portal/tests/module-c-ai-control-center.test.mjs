import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(path) { return fs.readFileSync(path, 'utf8'); }

test('ACC shell exposes AI control center and health endpoint is secret-free', () => {
  const shell = read('app/acc-shell.tsx');
  const health = read('app/api/ai/health/route.ts');
  assert.match(shell, /\/ai/);
  assert.match(health, /requireAccRole/);
  assert.doesNotMatch(health, /GEMINI_API_KEY\s*[:=].*process\.env|apiKey\s*:/);
});

test('ACC AI analysis queue is role checked and hard-capped at 50', () => {
  const route = read('app/api/ai/analyses/route.ts');
  const ops = read('lib/ai-ops.ts');
  assert.match(route, /requireAccRole\(request, 'mod'\)/);
  assert.match(ops, /Math\.min\(50/);
});

test('ACC AI page composes health, analyses and knowledge source controls', () => {
  const page = read('app/ai/page.tsx');
  const component = read('app/components/ai-control-center.tsx');
  assert.match(page, /AiControlCenter/);
  assert.match(component, /\/api\/ai\/health/);
  assert.match(component, /\/api\/ai\/analyses/);
  assert.match(component, /\/api\/ai\/knowledge/);
});
