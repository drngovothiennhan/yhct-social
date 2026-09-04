import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  buildMigrationSummary,
  normalizeMigrationActivity,
  normalizeMigrationMember,
  validateMigrationBundle,
} from '../lib/domain/migration.ts';

const EXPECTED_PROJECT_ID = 'yhct-social-260902-42a4';

function parseArgs(argv) {
  let dir = '';
  let dryRun = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dry-run') dryRun = true;
    if (argv[i] === '--dir') {
      dir = argv[i + 1] || '';
      i += 1;
    }
  }
  if (!dir) throw new Error('Thiếu --dir <migration-directory>.');
  return { dir: resolve(dir), dryRun };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function loadBundle(dir) {
  const rawMembers = await readJson(resolve(dir, 'members.sanitized.json'));
  const rawActivities = await readJson(resolve(dir, 'activities.json'));
  if (!Array.isArray(rawMembers) || !Array.isArray(rawActivities)) {
    throw new Error('Migration bundle phải chứa hai mảng JSON hợp lệ.');
  }
  const members = rawMembers.map(normalizeMigrationMember);
  const activities = rawActivities.map(normalizeMigrationActivity);
  validateMigrationBundle(members, activities);
  return { members, activities };
}

async function importToFirestore(bundle) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  if (projectId !== EXPECTED_PROJECT_ID) {
    throw new Error(`Sai Firebase project. Expected ${EXPECTED_PROJECT_ID}.`);
  }

  const { applicationDefault, getApps, initializeApp } = await import('firebase-admin/app');
  const { FieldValue, getFirestore } = await import('firebase-admin/firestore');

  const app = getApps()[0] || initializeApp({ credential: applicationDefault(), projectId });
  const db = getFirestore(app);
  const writer = db.bulkWriter();

  for (const member of bundle.members) {
    const { legacyMemberKey, ...fields } = member;
    writer.set(db.collection('migrationMembers').doc(legacyMemberKey), {
      ...fields,
      legacyMemberKey,
      importedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  for (const activity of bundle.activities) {
    const { id, ...fields } = activity;
    writer.set(db.collection('activities').doc(id), {
      ...fields,
      sourceId: id,
      importedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await writer.close();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const bundle = await loadBundle(args.dir);
  const summary = buildMigrationSummary(bundle.members, bundle.activities);

  if (args.dryRun) {
    console.log(`MIGRATION_DRY_RUN=PASS members=${summary.members} activities=${summary.activities} admin=${summary.roles.admin} moderator=${summary.roles.moderator} member=${summary.roles.member}`);
    return;
  }

  await importToFirestore(bundle);
  console.log(`MIGRATION_IMPORT=PASS members=${summary.members} activities=${summary.activities}`);
}

main().catch((error) => {
  console.error(`MIGRATION_IMPORT=FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
