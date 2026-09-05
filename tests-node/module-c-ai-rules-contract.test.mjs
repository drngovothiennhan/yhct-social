import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const rules = fs.readFileSync('firestore.rules', 'utf8');

const defaultDeny = rules.match(/match \/\{document=\*\*\} \{([\s\S]*?)\n    \}/);

test('Firestore keeps an authoritative default-deny boundary for unknown server collections', () => {
  assert.ok(defaultDeny, 'missing default deny');
  assert.match(defaultDeny[1], /allow read, write: if false/);
});

for (const collection of ['aiAnalyses', 'aiKnowledgeSources', 'aiQuotaDaily', 'aiQuotaWindows']) {
  test(`${collection} stays server-owned under default deny or an explicit deny`, () => {
    const escaped = collection.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const explicit = rules.match(new RegExp(`match \\/${escaped}\\/\\{[^}]+\\} \\{([\\s\\S]*?)\\n    \\}`));
    if (!explicit) {
      assert.ok(defaultDeny, `${collection} has no explicit rule and requires default deny`);
      return;
    }
    assert.match(explicit[1], /allow read, write: if false|allow read: if false[\s\S]*allow write: if false/);
  });
}
