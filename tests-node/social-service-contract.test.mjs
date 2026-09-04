import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const postService = await readFile(new URL('../lib/post-service.ts', import.meta.url), 'utf8');
const commentService = await readFile(new URL('../lib/comment-service.ts', import.meta.url), 'utf8');
const storageService = await readFile(new URL('../lib/storage-service.ts', import.meta.url), 'utf8');
const reactionService = await readFile(new URL('../lib/reaction-service.ts', import.meta.url), 'utf8');

test('social post service exposes bounded cursor feed and Module B publisher', () => {
  assert.match(postService, /export const SOCIAL_FEED_PAGE_SIZE = 20/);
  assert.match(postService, /export async function loadFeedPage/);
  assert.match(postService, /startAfter\(/);
  assert.match(postService, /export async function createSocialPost/);
  assert.match(postService, /buildSocialPostPayload/);
});

test('post media uses canonical social storage subtree with deterministic cleanup', () => {
  assert.match(storageService, /social\/posts\/\$\{input\.uid\}\/\$\{input\.postId\}/);
  assert.match(storageService, /export async function uploadSocialPostImages/);
  assert.match(storageService, /deleteObject/);
});

test('reaction service is nested and idempotent by uid', () => {
  assert.match(reactionService, /posts', postId, 'reactions', uid/);
  assert.match(reactionService, /export async function setPostReaction/);
  assert.match(reactionService, /export async function clearPostReaction/);
  assert.match(reactionService, /subscribePostReactions/);
});

test('social comments live under the post and expose create edit soft-delete', () => {
  assert.match(commentService, /posts', postId, 'comments'/);
  assert.match(commentService, /export async function createPostComment/);
  assert.match(commentService, /export async function editPostComment/);
  assert.match(commentService, /export async function softDeletePostComment/);
});

test('client services do not increment cached parent counters', () => {
  assert.doesNotMatch(postService, /increment\(/);
  assert.doesNotMatch(reactionService, /reactionCount\s*:/);
  assert.doesNotMatch(commentService, /commentCount\s*:/);
});
