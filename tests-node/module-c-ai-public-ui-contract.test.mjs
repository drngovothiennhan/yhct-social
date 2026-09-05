import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(path) { return fs.readFileSync(path, 'utf8'); }

test('public AI research UI separates internal CLB and external literature modes', () => {
  const source = read('components/portal/ai-research-panel.tsx');
  assert.match(source, /Nội bộ CLB/);
  assert.match(source, /Y văn bên ngoài/);
  assert.match(source, /\/api\/ai\/rag\/internal/);
  assert.match(source, /\/api\/ai\/rag\/external/);
  assert.match(source, /sources/);
});

test('portal shell mounts AI research and hardware controls without replacing core navigation', () => {
  const source = read('components/portal/portal-shell.tsx');
  assert.match(source, /AiResearchPanel/);
  assert.match(source, /HardwareModeControl/);
  assert.match(source, /PORTAL_NAVIGATION/);
});
