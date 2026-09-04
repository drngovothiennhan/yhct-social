import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSocialPostPayload,
  normalizeReactionType,
  validateCommentText,
  validateSocialPostDraft,
} from '../lib/domain/social.ts';

const member = {
  uid: 'u-member',
  displayName: 'Thành viên A',
  photoURL: '',
  role: 'member',
};

const moderator = { ...member, uid: 'u-mod', role: 'mod' };

function draft(overrides = {}) {
  return {
    kind: 'member_post',
    visibility: 'members',
    text: 'Nội dung hợp lệ',
    media: [],
    activityId: null,
    ...overrides,
  };
}

test('member post requires non-empty bounded text', () => {
  assert.equal(validateSocialPostDraft(draft({ text: '   ' }), member).ok, false);
  assert.equal(validateSocialPostDraft(draft({ text: 'a'.repeat(12001) }), member).ok, false);
  assert.equal(validateSocialPostDraft(draft(), member).ok, true);
});

test('ordinary member cannot create privileged club content', () => {
  assert.equal(validateSocialPostDraft(draft({ kind: 'club_news' }), member).ok, false);
  assert.equal(validateSocialPostDraft(draft({ kind: 'activity_update' }), member).ok, false);
  assert.equal(validateSocialPostDraft(draft({ kind: 'club_news' }), moderator).ok, true);
});

test('social post supports no more than six images', () => {
  const media = Array.from({ length: 7 }, (_, index) => ({
    type: 'image',
    storagePath: `social/posts/u/p/${index}.jpg`,
    downloadURL: `https://example.test/${index}.jpg`,
    width: null,
    height: null,
  }));
  assert.equal(validateSocialPostDraft(draft({ media }), member).ok, false);
});

test('payload initializes immutable snapshots and counters', () => {
  const payload = buildSocialPostPayload(draft(), member);
  assert.equal(payload.authorId, member.uid);
  assert.equal(payload.authorNameSnapshot, member.displayName);
  assert.equal(payload.authorRoleSnapshot, 'member');
  assert.equal(payload.reactionCount, 0);
  assert.equal(payload.commentCount, 0);
  assert.equal(payload.edited, false);
  assert.equal(payload.status, 'active');
});

test('reaction types are normalized to the explicit allow-list', () => {
  assert.equal(normalizeReactionType('heart'), 'heart');
  assert.equal(normalizeReactionType('support'), 'support');
  assert.equal(normalizeReactionType('LIKE'), 'like');
  assert.equal(normalizeReactionType('angry'), null);
});

test('comments require one to 4000 trimmed characters', () => {
  assert.equal(validateCommentText('  ').ok, false);
  assert.equal(validateCommentText('a'.repeat(4001)).ok, false);
  assert.equal(validateCommentText(' Cảm ơn chia sẻ ').ok, true);
});
