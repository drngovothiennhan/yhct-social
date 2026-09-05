import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('Module C uses current Gemini SDK and keeps its key server-only', () => {
  const pkg = JSON.parse(read('package.json'));
  const env = read('.env.example');
  const config = read('lib/server/ai/config.ts');
  const auth = read('lib/server/ai/auth.ts');

  assert.ok(pkg.dependencies['@google/genai']);
  assert.ok(pkg.dependencies.zod);
  assert.ok(pkg.dependencies.mammoth);
  assert.match(env, /^GEMINI_API_KEY=/m);
  assert.doesNotMatch(env, /NEXT_PUBLIC_GEMINI/i);
  assert.match(config, /GEMINI_MODEL_FAST/);
  assert.match(auth, /verifyIdToken/);
});

test('Module C root server auth uses OIDC or application default without JSON/token fallback', () => {
  const admin = read('lib/server/firebase-admin.ts');
  assert.match(admin, /getVercelOidcToken/);
  assert.match(admin, /applicationDefault/);
  assert.doesNotMatch(admin, /credentials_json|GCP_SERVICE_ACCOUNT_JSON|FIREBASE_TOKEN/i);
});
