import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

for (const file of ['app/error.tsx', 'app/global-error.tsx']) {
  test(`${file} is a sanitized client error boundary`, () => {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /^['"]use client['"]/);
    assert.match(source, /reset\(\)/);
    assert.match(source, /Thử lại|Tải lại|retry/i);
    assert.doesNotMatch(source, /error\.message|error\.stack|JSON\.stringify\(error\)|localStorage|sessionStorage|authorization|Bearer/);
  });
}

test('global error boundary owns html and body fallback shell', () => {
  const source = fs.readFileSync('app/global-error.tsx', 'utf8');
  assert.match(source, /<html/);
  assert.match(source, /<body/);
});
