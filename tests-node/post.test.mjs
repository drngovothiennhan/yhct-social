import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPostPayload, validatePostDraft } from '../lib/domain/post.ts';

const verifiedPractitioner = {
  uid: 'doctor-1',
  displayName: 'Lương y Minh',
  photoURL: '',
  professionalTitle: 'Lương y',
  accountType: 'practitioner',
  verificationStatus: 'verified',
};

test('clinical cases must be de-identified', () => {
  const result = validatePostDraft({
    type: 'clinical_case', title: 'Ca đau vai gáy', content: 'Mô tả bệnh án',
    tags: [], professionalLabel: false, isDeidentified: false,
  }, verifiedPractitioner);
  assert.equal(result.ok, false);
  assert.match(result.message, /ẩn danh/i);
});

test('professional label requires verified practitioner', () => {
  const result = validatePostDraft({
    type: 'remedy', title: 'Bài thuốc tham khảo', content: 'Nội dung',
    tags: [], professionalLabel: true, isDeidentified: true,
  }, { ...verifiedPractitioner, verificationStatus: 'pending' });
  assert.equal(result.ok, false);
  assert.match(result.message, /xác minh/i);
});

test('post payload trims text and tags while preserving rule-controlled fields', () => {
  const payload = buildPostPayload({
    type: 'remedy', title: '  Bài thuốc kiện tỳ  ', content: '  Nội dung chuyên môn  ',
    tags: ['Tỳ vị', '  khí huyết '], professionalLabel: true, isDeidentified: true,
  }, verifiedPractitioner, ['post-media/doctor-1/p1/a.webp']);
  assert.equal(payload.title, 'Bài thuốc kiện tỳ');
  assert.equal(payload.content, 'Nội dung chuyên môn');
  assert.deepEqual(payload.tags, ['Tỳ vị', 'khí huyết']);
  assert.equal(payload.status, 'published');
  assert.equal(payload.authorId, 'doctor-1');
  assert.equal(payload.professionalLabel, true);
});
