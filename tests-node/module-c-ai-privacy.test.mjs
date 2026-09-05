import assert from 'node:assert/strict';
import test from 'node:test';
import { assertAiSafeText } from '../lib/server/ai/privacy.ts';

test('AI privacy rejects provisioning credentials and direct identity labels', () => {
  assert.throws(
    () => assertAiSafeText({ text: 'MSSV: 22123456; mật khẩu: 22123456' }),
    /AI_SENSITIVE_DATA/,
  );
  assert.throws(
    () => assertAiSafeText({ text: 'CCCD: 079123456789' }),
    /AI_SENSITIVE_DATA/,
  );
  assert.throws(
    () => assertAiSafeText({ text: 'Email: sinhvien@example.com; password: secret123' }),
    /AI_SENSITIVE_DATA/,
  );
  assert.throws(
    () => assertAiSafeText({ text: 'Minh chứng chứng chỉ hành nghề: certificates/u1/private.pdf' }),
    /AI_SENSITIVE_DATA/,
  );
});

test('clinical AI rejects identifiable patient markers', () => {
  assert.throws(
    () => assertAiSafeText({ text: 'Bệnh nhân Nguyễn Văn A, SĐT 0901234567, đau đầu 3 ngày.', clinicalCase: true }),
    /AI_CLINICAL_NOT_DEIDENTIFIED/,
  );
});

test('safe normalized academic text yields a stable SHA-256 content hash', () => {
  const a = assertAiSafeText({ text: '  Tỳ khí hư   thường biểu hiện mệt mỏi.  ' });
  const b = assertAiSafeText({ text: 'Tỳ khí hư thường biểu hiện mệt mỏi.' });
  assert.equal(a.sanitized, b.sanitized);
  assert.equal(a.contentHash, b.contentHash);
  assert.match(a.contentHash, /^[a-f0-9]{64}$/);
});
