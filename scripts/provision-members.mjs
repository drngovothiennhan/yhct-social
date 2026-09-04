import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import {
  buildProvisioningPlan,
  buildProvisioningSourceHash,
  buildProvisioningSummary,
  dedupeRosterRows,
  generateActivationPassword,
  parseRosterCsv,
} from '../lib/domain/provisioning.ts';

const PROJECT_ID = 'yhct-social-260902-42a4';

function parseArgs(argv) {
  const args = { file: '', dryRun: false, activationOutput: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--file') args.file = argv[++index] ?? '';
    else if (arg === '--activation-output') args.activationOutput = argv[++index] ?? '';
    else throw new Error(`Tham số không hỗ trợ: ${arg}`);
  }
  if (!args.file) throw new Error('Thiếu --file <roster.csv>.');
  if (!args.dryRun && !args.activationOutput) {
    throw new Error('Import thật yêu cầu --activation-output <private.csv>.');
  }
  return args;
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function printSummary(prefix, summary, extras = {}) {
  const fields = [
    `${prefix}=PASS`,
    `members=${summary.members}`,
    `admin=${summary.roles.admin}`,
    `super_mod=${summary.roles.super_mod}`,
    `mod=${summary.roles.mod}`,
    `member=${summary.roles.member}`,
    `conflicts=${summary.conflicts}`,
  ];
  for (const [key, value] of Object.entries(extras)) fields.push(`${key}=${value}`);
  console.log(fields.join(' '));
}

function readPlan(filePath) {
  const csv = readFileSync(resolve(filePath), 'utf8');
  const members = dedupeRosterRows(parseRosterCsv(csv));
  return { members, plan: buildProvisioningPlan(members), summary: buildProvisioningSummary(members) };
}

async function getUserByEmailOrNull(auth, email) {
  try {
    return await auth.getUserByEmail(email);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') return null;
    throw error;
  }
}

async function getUserByUidOrNull(auth, uid) {
  try {
    return await auth.getUser(uid);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') return null;
    throw error;
  }
}

async function findOrCreateUser(auth, member, ledgerData) {
  const ledgerUid = typeof ledgerData?.uid === 'string' ? ledgerData.uid : '';
  const ledgerUser = ledgerUid ? await getUserByUidOrNull(auth, ledgerUid) : null;
  const emailUser = await getUserByEmailOrNull(auth, member.syntheticEmail);

  if (ledgerUser && emailUser && ledgerUser.uid !== emailUser.uid) {
    throw new Error(`PROVISION_CONFLICT member=${member.memberCode} reason=LEDGER_UID_EMAIL_UID_MISMATCH`);
  }
  if (ledgerUid && !ledgerUser && emailUser && emailUser.uid !== ledgerUid) {
    throw new Error(`PROVISION_CONFLICT member=${member.memberCode} reason=STALE_LEDGER_UID`);
  }

  const existing = ledgerUser ?? emailUser;
  if (existing) return { user: existing, activationPassword: '', created: false };

  const activationPassword = generateActivationPassword();
  const user = await auth.createUser({
    email: member.syntheticEmail,
    password: activationPassword,
    displayName: member.displayName || member.memberCode,
    emailVerified: false,
    disabled: false,
  });
  return { user, activationPassword, created: true };
}

async function provisionMember(auth, db, member) {
  const ledgerRef = db.collection('clubProvisioning').doc(member.memberCode);
  const ledgerSnapshot = await ledgerRef.get();
  const ledgerData = ledgerSnapshot.exists ? ledgerSnapshot.data() : null;
  const sourceHash = buildProvisioningSourceHash(member);

  const { user, activationPassword, created } = await findOrCreateUser(auth, member, ledgerData);
  if (ledgerData?.uid && ledgerData.uid !== user.uid) {
    throw new Error(`PROVISION_CONFLICT member=${member.memberCode} reason=LEDGER_UID_MISMATCH`);
  }

  const current = await auth.getUser(user.uid);
  const previousClaims = current.customClaims ?? {};
  const mustChangePassword = created ? true : previousClaims.mustChangePassword !== false;

  await auth.setCustomUserClaims(user.uid, {
    ...previousClaims,
    role: member.role,
    clubMember: true,
    mustChangePassword,
  });

  const userRef = db.collection('users').doc(user.uid);
  const userSnapshot = await userRef.get();
  const profilePatch = {
    displayName: member.displayName || current.displayName || member.memberCode,
    accountType: 'student',
    role: member.role,
    verificationStatus: 'not_required',
    professionalTitle: member.title,
    clubTitle: member.title,
    memberCode: member.memberCode,
    provisioningSource: 'roster',
    accountStatus: current.disabled ? 'disabled' : 'active',
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (!userSnapshot.exists) {
    Object.assign(profilePatch, {
      photoURL: '',
      bio: '',
      specialties: [],
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  await userRef.set(profilePatch, { merge: true });
  await userRef.collection('private').doc('access').set({
    memberCode: member.memberCode,
    syntheticEmail: member.syntheticEmail,
    mustChangePassword,
    sourceConflict: member.sourceConflict,
    provisioningSource: 'roster',
    sourceHash,
    sourceImportedAt: FieldValue.serverTimestamp(),
    disabled: current.disabled,
  }, { merge: true });

  const ledgerPatch = {
    uid: user.uid,
    memberCode: member.memberCode,
    sourceHash,
    status: 'provisioned',
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (!ledgerSnapshot.exists) ledgerPatch.createdAt = FieldValue.serverTimestamp();
  await ledgerRef.set(ledgerPatch, { merge: true });

  return { created, memberCode: member.memberCode, syntheticEmail: member.syntheticEmail, activationPassword };
}

function writeActivationFile(path, rows) {
  const lines = ['memberCode,syntheticEmail,activationPassword'];
  for (const row of rows) {
    lines.push([row.memberCode, row.syntheticEmail, row.activationPassword].map(csvEscape).join(','));
  }
  const target = resolve(path);
  writeFileSync(target, `${lines.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
  chmodSync(target, 0o600);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { plan, summary } = readPlan(args.file);

  if (args.dryRun) {
    printSummary('PROVISION_DRY_RUN', summary);
    return;
  }

  const resolvedProject = process.env.GOOGLE_CLOUD_PROJECT
    || process.env.GCLOUD_PROJECT
    || process.env.GCP_PROJECT
    || process.env.FIREBASE_PROJECT_ID;
  if (resolvedProject !== PROJECT_ID) {
    throw new Error(`PROVISION_BLOCKED project=${resolvedProject || 'unset'} expected=${PROJECT_ID}`);
  }

  const app = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  const auth = getAuth(app);
  const db = getFirestore(app);
  const activationRows = [];
  let created = 0;
  let updated = 0;

  for (const member of plan) {
    const result = await provisionMember(auth, db, member);
    if (result.created) {
      created += 1;
      activationRows.push(result);
    } else {
      updated += 1;
    }
  }

  writeActivationFile(args.activationOutput, activationRows);
  printSummary('PROVISION_IMPORT', summary, { created, updated, activation_credentials: activationRows.length });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
