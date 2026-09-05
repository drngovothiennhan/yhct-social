import { randomBytes } from 'node:crypto';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'yhct-social-260902-42a4';
const API_KEY = process.env.FIREBASE_WEB_API_KEY?.trim() || '';
const ACC_BASE_URL = (process.env.ACC_BASE_URL || 'https://yhct-social-admin.vercel.app').replace(/\/$/, '');

const ACCOUNTS = [
  { uid: 'e2e-member-001', memberCode: 'E2E_MEMBER_001', email: 'e2e_member_001@members.yhct.hiu.vn', role: 'member' },
  { uid: 'e2e-mod-001', memberCode: 'E2E_MOD_001', email: 'e2e_mod_001@members.yhct.hiu.vn', role: 'mod' },
  { uid: 'e2e-admin-001', memberCode: 'E2E_ADMIN_001', email: 'e2e_admin_001@members.yhct.hiu.vn', role: 'admin' },
];

function strongSecret() {
  return `${randomBytes(30).toString('base64url')}Aa1!`;
}

async function signInWithPassword(email, secret) {
  if (!API_KEY) throw new Error('E2E_FIREBASE_WEB_API_KEY_MISSING');
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: secret, returnSecureToken: true }),
  });
  if (!response.ok) throw new Error(`E2E_SIGN_IN_FAILED status=${response.status}`);
  const body = await response.json();
  if (!body.idToken) throw new Error('E2E_SIGN_IN_TOKEN_MISSING');
  return body.idToken;
}

async function upsertSyntheticAccount(auth, db, account, secret) {
  try {
    await auth.getUser(account.uid);
    await auth.updateUser(account.uid, {
      email: account.email,
      password: secret,
      displayName: account.memberCode,
      disabled: false,
    });
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
    await auth.createUser({
      uid: account.uid,
      email: account.email,
      password: secret,
      displayName: account.memberCode,
      emailVerified: false,
      disabled: false,
    });
  }

  await auth.setCustomUserClaims(account.uid, {
    role: account.role,
    clubMember: true,
    mustChangePassword: false,
    e2e: true,
  });

  const userRef = db.collection('users').doc(account.uid);
  await userRef.set({
    displayName: account.memberCode,
    accountType: 'student',
    role: account.role,
    verificationStatus: 'not_required',
    professionalTitle: '',
    clubTitle: '',
    memberCode: account.memberCode,
    provisioningSource: 'e2e',
    accountStatus: 'active',
    photoURL: '',
    bio: '',
    specialties: [],
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await userRef.collection('private').doc('access').set({
    memberCode: account.memberCode,
    syntheticEmail: account.email,
    mustChangePassword: false,
    provisioningSource: 'e2e',
    sourceConflict: false,
    disabled: false,
    sourceImportedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function verifyLogin(auth, account, secret) {
  const token = await signInWithPassword(account.email, secret);
  const decoded = await auth.verifyIdToken(token);
  if (decoded.uid !== account.uid || decoded.role !== account.role || decoded.clubMember !== true || decoded.mustChangePassword === true) {
    throw new Error(`E2E_CLAIMS_INVALID role=${account.role}`);
  }
  return token;
}

async function verifyPasswordChange(auth, account, token) {
  const replacement = strongSecret();
  const response = await fetch(`${ACC_BASE_URL}/api/session/change-password`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: replacement }),
  });
  if (!response.ok) throw new Error(`E2E_PASSWORD_CHANGE_FAILED status=${response.status}`);
  const refreshed = await signInWithPassword(account.email, replacement);
  const decoded = await auth.verifyIdToken(refreshed);
  if (decoded.uid !== account.uid || decoded.mustChangePassword === true) throw new Error('E2E_PASSWORD_CHANGE_VERIFY_FAILED');
}

async function provisionAndTest() {
  const app = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const sessions = new Map();

  for (const account of ACCOUNTS) {
    const secret = strongSecret();
    await upsertSyntheticAccount(auth, db, account, secret);
    sessions.set(account.uid, await verifyLogin(auth, account, secret));
  }

  const admin = ACCOUNTS.find((account) => account.role === 'admin');
  if (!admin) throw new Error('E2E_ADMIN_MISSING');
  await verifyPasswordChange(auth, admin, sessions.get(admin.uid));
  console.log('E2E_AUTH=PASS accounts=3 roles=member,mod,admin self_service_rotation=PASS');
}

async function validateRecoveryDatabase(databaseId) {
  if (!/^recovery-v2-final-[a-z0-9-]+$/.test(databaseId)) throw new Error('E2E_RECOVERY_DATABASE_INVALID');
  const app = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  const recoveryDb = getFirestore(app, databaseId);
  for (const account of ACCOUNTS) {
    const [profile, access] = await Promise.all([
      recoveryDb.collection('users').doc(account.uid).get(),
      recoveryDb.collection('users').doc(account.uid).collection('private').doc('access').get(),
    ]);
    if (!profile.exists || !access.exists) throw new Error(`E2E_RECOVERY_VALIDATION_FAILED role=${account.role}`);
    if (profile.get('role') !== account.role || access.get('mustChangePassword') === true) {
      throw new Error(`E2E_RECOVERY_CONTENT_INVALID role=${account.role}`);
    }
  }
  console.log('E2E_RECOVERY=PASS profiles=3 private_access=3');
}

async function main() {
  const mode = process.argv[2] || '--provision-and-test';
  if (mode === '--provision-and-test') return provisionAndTest();
  if (mode === '--validate-recovery') {
    const databaseId = process.env.RECOVERY_DATABASE_ID?.trim() || '';
    return validateRecoveryDatabase(databaseId);
  }
  throw new Error('E2E_MODE_INVALID');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.replace(/[A-Za-z0-9_-]{32,}/g, '[redacted]'));
  process.exit(1);
});
