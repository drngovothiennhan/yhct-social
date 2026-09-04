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
