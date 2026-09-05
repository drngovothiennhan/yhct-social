import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportId, validateReportDraft, REPORT_REASON_CODES } from '../lib/domain/report.ts';

test('buildReportId creates deterministic IDs for post and comment reports', () => {
  assert.equal(
    buildReportId({ reporterUid: 'u1', targetType: 'post', postId: 'p1', commentId: null }),
    'post__p1__u1',
  );
  assert.equal(
    buildReportId({ reporterUid: 'u1', targetType: 'comment', postId: 'p1', commentId: 'c1' }),
    'comment__p1__c1__u1',
  );
});

test('validateReportDraft enforces fixed reasons and exact 2000-character details limit', () => {
  assert.deepEqual(REPORT_REASON_CODES, ['spam', 'misinformation', 'inappropriate', 'privacy', 'other']);
  assert.doesNotThrow(() => validateReportDraft({ reasonCode: 'spam', details: 'x'.repeat(2000) }));
  assert.throws(() => validateReportDraft({ reasonCode: 'spam', details: 'x'.repeat(2001) }), /2000/);
  assert.throws(() => validateReportDraft({ reasonCode: 'unknown', details: '' }), /reason/i);
});

test('comment report requires a commentId', () => {
  assert.throws(
    () => buildReportId({ reporterUid: 'u1', targetType: 'comment', postId: 'p1', commentId: null }),
    /commentId/,
  );
});
