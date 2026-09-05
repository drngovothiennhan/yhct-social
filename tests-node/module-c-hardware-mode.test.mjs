import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveHardwareMode } from '../lib/hardware-mode.ts';

test('hardware classifier defaults safely and honors low-resource signals', () => {
  assert.equal(deriveHardwareMode({ hardwareConcurrency: 2, deviceMemory: 2, saveData: false, reducedMotion: false }), 'lite');
  assert.equal(deriveHardwareMode({ hardwareConcurrency: 8, deviceMemory: 8, saveData: false, reducedMotion: false }), 'enhanced');
  assert.equal(deriveHardwareMode({ hardwareConcurrency: undefined, deviceMemory: undefined, saveData: undefined, reducedMotion: false }), 'standard');
  assert.equal(deriveHardwareMode({ hardwareConcurrency: 8, deviceMemory: 8, saveData: true, reducedMotion: false }), 'lite');
  assert.equal(deriveHardwareMode({ hardwareConcurrency: 8, deviceMemory: 8, saveData: false, reducedMotion: true }), 'lite');
});
