import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const firestoreRules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const storageRules = await readFile(new URL('../storage.rules', import.meta.url), 'utf8');

test('Firestore defaults unknown paths to deny', () => {
  assert.match(firestoreRules, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/s);
});

test('professional labels require a verified practitioner in rules', () => {
  assert.match(firestoreRules, /currentUser\(\)\.accountType == 'practitioner'/);
  assert.match(firestoreRules, /currentUser\(\)\.verificationStatus == 'verified'/);
  assert.match(firestoreRules, /!data\.professionalLabel \|\| isVerifiedPractitioner\(\)/);
});

test('deleted comment tombstones remain readable on published posts', () => {
  assert.match(firestoreRules, /resource\.data\.status in \['active', 'deleted'\]/);
});

test('certificate storage is private to owner and moderators', () => {
  assert.match(storageRules, /match \/certificates\/\{uid\}\/\{fileName\}/);
  assert.match(storageRules, /allow read: if \(signedIn\(\) && request\.auth\.uid == uid\) \|\| isModerator\(\);/);
});

test('migration member staging is private and client read-only', () => {
  assert.match(firestoreRules, /match \/migrationMembers\/\{memberKey\} \{\s*allow read: if isModerator\(\);\s*allow write: if false;/s);
});

test('activities expose only published records to public clients', () => {
  assert.match(firestoreRules, /match \/activities\/\{activityId\} \{\s*allow read: if resource\.data\.status == 'published' \|\| isModerator\(\);\s*allow write: if false;/s);
});

test('privileged moderation is claim-first with all Beta 2.0 roles', () => {
  assert.match(firestoreRules, /request\.auth\.token\.role in \['mod', 'super_mod', 'admin'\]/);
  assert.match(firestoreRules, /request\.auth\.token\.role in \['super_mod', 'admin'\]/);
  assert.match(firestoreRules, /request\.auth\.token\.role == 'admin'/);
});

test('legacy moderator remains read-compatible only during role migration', () => {
  assert.match(firestoreRules, /currentUser\(\)\.role in \['moderator', 'admin'\]/);
});

test('client self-update cannot mutate RBAC or provisioning identity fields', () => {
  assert.match(firestoreRules, /after\.diff\(before\)\.affectedKeys\(\)\.hasOnly\(\[[^\]]*'displayName'[^\]]*'updatedAt'[^\]]*\]\)/s);
  assert.match(firestoreRules, /after\.role == before\.role/);
  assert.match(firestoreRules, /after\.memberCode == before\.memberCode/);
  assert.match(firestoreRules, /after\.provisioningSource == before\.provisioningSource/);
  assert.match(firestoreRules, /after\.professionalTitle == before\.professionalTitle/);
});

test('private access document is never client-writable', () => {
  assert.match(firestoreRules, /match \/private\/\{documentId\} \{[\s\S]*documentId == 'access'[\s\S]*allow write: if false;/);
});
