import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const navigation = await readFile(new URL('../lib/navigation.ts', import.meta.url), 'utf8');
const members = await readFile(new URL('../lib/member-service.ts', import.meta.url), 'utf8');
const activities = await readFile(new URL('../lib/activity-service.ts', import.meta.url), 'utf8');
const shell = await readFile(new URL('../components/portal/portal-shell.tsx', import.meta.url), 'utf8');
const feed = await readFile(new URL('../components/portal/social-feed.tsx', import.meta.url), 'utf8');
const composer = await readFile(new URL('../components/portal/social-composer.tsx', import.meta.url), 'utf8');
const comments = await readFile(new URL('../components/portal/social-comments.tsx', import.meta.url), 'utf8');
const ci = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const beta2Rules = await readFile(new URL('../.github/workflows/deploy-beta2-firestore-rules.yml', import.meta.url), 'utf8');
const productionRules = await readFile(new URL('../.github/workflows/deploy-firebase-rules.yml', import.meta.url), 'utf8');

const routes = await Promise.all([
  '../app/feed/page.tsx',
  '../app/members/page.tsx',
  '../app/members/[uid]/page.tsx',
  '../app/profile/page.tsx',
  '../app/activities/page.tsx',
  '../app/activities/[id]/page.tsx',
  '../app/posts/[postId]/page.tsx',
].map((path) => readFile(new URL(path, import.meta.url), 'utf8')));

test('portal navigation exposes the four approved primary destinations', () => {
  for (const href of ['/feed', '/activities', '/members', '/profile']) {
    assert.match(navigation, new RegExp(`href: '${href.replace('/', '\\/')}'`));
  }
});

test('member directory is bounded and self-profile updates use an explicit allow-list', () => {
  assert.match(members, /MEMBER_DIRECTORY_PAGE_SIZE = 50/);
  assert.match(members, /limit\(MEMBER_DIRECTORY_PAGE_SIZE\)/);
  assert.match(members, /buildSelfProfileUpdate/);
  assert.match(members, /displayName/);
  assert.match(members, /photoURL/);
  assert.match(members, /bio/);
  assert.match(members, /specialties/);
  assert.doesNotMatch(members, /private\/access/);
  assert.doesNotMatch(members, /clubProvisioning/);
});

test('activity discovery is published-only and bounded', () => {
  assert.match(activities, /ACTIVITY_PAGE_SIZE = 30/);
  assert.match(activities, /where\('status', '==', 'published'\)/);
  assert.match(activities, /limit\(ACTIVITY_PAGE_SIZE\)/);
  assert.match(activities, /loadActivityRelatedPosts/);
});

test('portal shell has desktop rail and mobile bottom navigation', () => {
  assert.match(shell, /lg:grid-cols-\[220px_minmax\(0,1fr\)_300px\]/);
  assert.match(shell, /fixed bottom-0/);
  assert.match(shell, /PORTAL_NAVIGATION/);
});

test('social feed uses bounded cursor pagination and composer is claim-aware', () => {
  assert.match(feed, /loadFeedPage/);
  assert.match(feed, /loadMore/);
  assert.match(feed, /filter/);
  assert.match(composer, /createSocialPost/);
  assert.match(composer, /mustChangePassword/);
  assert.match(composer, /club_news/);
});

test('comments use the nested Module B comment service', () => {
  assert.match(comments, /subscribeSocialPostComments/);
  assert.match(comments, /createPostComment/);
  assert.match(comments, /softDeletePostComment/);
});

test('all approved portal routes exist', () => {
  for (const route of routes) assert.ok(route.length > 20);
});

test('CI validates pushes to both main and release v1.0', () => {
  assert.match(ci, /branches:\s*\[main, release\/v1\.0\]/);
});

test('release branch validates Firebase policy without crossing the main WIF trust boundary', () => {
  assert.match(beta2Rules, /branches:\s*\[release\/v1\.0\]/);
  assert.doesNotMatch(beta2Rules, /google-github-actions\/auth/);
  assert.doesNotMatch(beta2Rules, /firebase-tools.*deploy/s);
  assert.match(productionRules, /branches:\s*\[main\]/);
  assert.match(productionRules, /providers\/github-main/);
  assert.match(productionRules, /firebase-tools@15\.29\.0 deploy/);
});
