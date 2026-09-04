import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../app/dashboard.tsx', import.meta.url), 'utf8');

test('ACC dashboard exposes member management actions through protected APIs', () => {
  assert.match(source, /action:\s*'role'/);
  assert.match(source, /action:\s*'title'/);
  assert.match(source, /action:\s*'disabled'/);
  assert.match(source, /action:\s*'verification'/);
  assert.match(source, /method:\s*'PATCH'/);
});

test('ACC dashboard exposes maintenance mode control for admin', () => {
  assert.match(source, /\/api\/system\/maintenance/);
  assert.match(source, /maintenanceMode/);
});
