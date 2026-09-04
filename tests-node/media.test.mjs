import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePostImages } from '../lib/domain/media.ts';

function fakeFile(name, type, size = 100) {
  return { name, type, size };
}

test('post media rejects more than six images', () => {
  const files = Array.from({ length: 7 }, (_, i) => fakeFile(`a${i}.jpg`, 'image/jpeg'));
  assert.throws(() => validatePostImages(files), /6 ảnh/i);
});

test('post media rejects unsupported image formats', () => {
  assert.throws(() => validatePostImages([fakeFile('a.gif', 'image/gif')]), /JPEG, PNG hoặc WebP/i);
});
