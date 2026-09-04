import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const indexes = JSON.parse(await readFile(new URL('../firestore.indexes.json', import.meta.url), 'utf8'));

test('social mutation gate requires club membership and completed password rotation', () => {
  assert.match(rules, /function canMutateSocial\(\)/);
  assert.match(rules, /request\.auth\.token\.clubMember == true/);
  assert.match(rules, /request\.auth\.token\.mustChangePassword != true/);
});

test('Module B posts use active hidden deleted status and immutable server counters', () => {
  assert.match(rules, /data\.status in \['active', 'hidden', 'deleted'\]/);
  assert.match(rules, /data\.reactionCount == 0/);
  assert.match(rules, /data\.commentCount == 0/);
  assert.match(rules, /after\.reactionCount == before\.reactionCount/);
  assert.match(rules, /after\.commentCount == before\.commentCount/);
});

test('ordinary members cannot create privileged club post kinds', () => {
  assert.match(rules, /data\.kind in \['member_post', 'club_news', 'activity_update'\]/);
  assert.match(rules, /data\.kind == 'member_post' \|\| isModerator\(\)/);
});

test('reactions are nested under posts and owned by the authenticated uid', () => {
  assert.match(rules, /match \/reactions\/\{uid\}/);
  assert.match(rules, /request\.resource\.data\.uid == uid/);
  assert.match(rules, /request\.resource\.data\.type in \['like', 'heart', 'support'\]/);
});

test('comments are nested under posts and preserve immutable ownership', () => {
  assert.match(rules, /match \/comments\/\{commentId\}/);
  assert.match(rules, /request\.resource\.data\.authorId == request\.auth\.uid/);
  assert.match(rules, /after\.authorId == before\.authorId/);
  assert.match(rules, /after\.createdAt == before\.createdAt/);
});

test('Module A protected user and private provisioning boundaries remain present', () => {
  assert.match(rules, /after\.role == before\.role/);
  assert.match(rules, /after\.memberCode == before\.memberCode/);
  assert.match(rules, /match \/clubProvisioning\/\{memberCode\} \{\s*allow read, write: if false;/s);
  assert.match(rules, /match \/private\/\{documentId\}[\s\S]*allow write: if false;/);
});

test('Module B feed composite indexes cover visibility kind activity and author cursors', () => {
  const signatures = indexes.indexes
    .filter((index) => index.collectionGroup === 'posts')
    .map((index) => index.fields.map((field) => field.fieldPath).join(','));

  assert.ok(signatures.includes('status,visibility,createdAt'));
  assert.ok(signatures.includes('status,kind,createdAt'));
  assert.ok(signatures.includes('status,activityId,createdAt'));
  assert.ok(signatures.includes('status,authorId,createdAt'));
});
