import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCommentTree, getReplyDepth } from '../lib/domain/comments.ts';

const base = {
  postId: 'p1', authorId: 'u1', authorDisplayName: 'A', authorPhotoURL: '',
  content: 'x', status: 'active', createdAt: null, updatedAt: null,
};

test('flat comments become a stable nested tree even if children arrive first', () => {
  const tree = buildCommentTree([
    { ...base, id: 'c2', parentId: 'c1', depth: 1 },
    { ...base, id: 'c1', parentId: '', depth: 0 },
    { ...base, id: 'c3', parentId: 'c2', depth: 2 },
  ]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0].id, 'c1');
  assert.equal(tree[0].children[0].id, 'c2');
  assert.equal(tree[0].children[0].children[0].id, 'c3');
});

test('reply depth is capped at level 3', () => {
  assert.equal(getReplyDepth(2), 3);
  assert.throws(() => getReplyDepth(3), /độ sâu/i);
});
