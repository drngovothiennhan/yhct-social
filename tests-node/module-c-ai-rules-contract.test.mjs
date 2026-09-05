import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const rules = fs.readFileSync('firestore.rules', 'utf8');

for (const collection of ['aiAnalyses', 'aiKnowledgeSources', 'aiQuotaDaily', 'aiQuotaWindows']) {
  test(`${collection} is server-owned and never directly client readable/writable`, () => {
    const escaped = collection.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = rules.match(new RegExp(`match \\/${escaped}\\/\\{[^}]+\\} \\{([\\s\\S]*?)\\n    \\}`));
    assert.ok(match, `missing ${collection} rules`);
    assert.match(match[1], /allow read, write: if false|allow read: if false[\s\S]*allow write: if false/);
  });
}
