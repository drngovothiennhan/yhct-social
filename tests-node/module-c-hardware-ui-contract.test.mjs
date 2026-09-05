import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(path) { return fs.readFileSync(path, 'utf8'); }

test('hardware provider is client-only, local-only and progressive', () => {
  const provider = read('components/providers/hardware-mode-provider.tsx');
  assert.match(provider, /'use client'/);
  assert.match(provider, /navigator\.hardwareConcurrency/);
  assert.match(provider, /deviceMemory/);
  assert.match(provider, /saveData/);
  assert.match(provider, /prefers-reduced-motion/);
  assert.match(provider, /localStorage/);
  assert.doesNotMatch(provider, /fetch\(|XMLHttpRequest|sendBeacon/);
});

test('root layout mounts hardware provider and CSS exposes lite mode reduction', () => {
  const layout = read('app/layout.tsx');
  const css = read('app/globals.css');
  assert.match(layout, /HardwareModeProvider/);
  assert.match(css, /data-hardware-mode=['"]?lite/);
  assert.match(css, /animation-duration|transition-duration/);
});
