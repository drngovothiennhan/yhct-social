import assert from 'node:assert/strict';
import test from 'node:test';
import { validateDocxUpload } from '../lib/server/ai/docx.ts';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

test('DOCX validation accepts only bounded non-empty .docx uploads', () => {
  assert.deepEqual(validateDocxUpload({ name: 'case.docx', type: DOCX, size: 1200 }, 5 * 1024 * 1024), { ok: true });
  assert.throws(() => validateDocxUpload({ name: 'case.pdf', type: 'application/pdf', size: 100 }, 5 * 1024 * 1024), /AI_DOCX_TYPE_INVALID/);
  assert.throws(() => validateDocxUpload({ name: 'case.docx', type: DOCX, size: 0 }, 5 * 1024 * 1024), /AI_DOCX_EMPTY/);
  assert.throws(() => validateDocxUpload({ name: 'case.docx', type: DOCX, size: 6 * 1024 * 1024 }, 5 * 1024 * 1024), /AI_DOCX_TOO_LARGE/);
});

test('DOCX validation tolerates generic browser MIME only when extension is docx', () => {
  assert.deepEqual(validateDocxUpload({ name: 'case.docx', type: 'application/octet-stream', size: 100 }, 1000), { ok: true });
  assert.throws(() => validateDocxUpload({ name: 'case.txt', type: 'application/octet-stream', size: 100 }, 1000), /AI_DOCX_TYPE_INVALID/);
});
