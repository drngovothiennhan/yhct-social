import { createHash } from 'node:crypto';
import { canDeleteAiKnowledge, canSyncAiKnowledge } from './ai-policy.ts';

export interface KnowledgeActor { uid: string; role: string }
export interface KnowledgeSourceInput { driveFileId: string; title: string; contentHash: string }
export interface KnowledgeManifest {
  sourceId: string;
  title: string;
  contentHash: string;
  providerDocumentId: string;
  status: 'ready';
  mimeType?: string;
  driveModifiedTime?: string;
}
export interface KnowledgeSyncResult {
  sourceId: string;
  providerDocumentId: string;
  status: 'unchanged' | 'synced';
}
export interface KnowledgeSyncDeps {
  readManifest(sourceId: string): Promise<KnowledgeManifest | null>;
  writeManifest(sourceId: string, value: KnowledgeManifest): Promise<void>;
  uploadToFileSearch(input: KnowledgeSourceInput): Promise<{ providerDocumentId: string }>;
  deleteFromFileSearch?(providerDocumentId: string): Promise<void>;
}

function cleanId(value: string): string {
  const result = value.trim();
  if (!result || result.length > 240 || !/^[A-Za-z0-9_-]+$/.test(result)) throw new Error('AI_KNOWLEDGE_INVALID_SOURCE');
  return result;
}

function cleanTitle(value: string): string {
  const result = value.trim();
  if (!result || result.length > 500) throw new Error('AI_KNOWLEDGE_INVALID_TITLE');
  return result;
}

function cleanVersionHash(value: string): string {
  const result = value.trim();
  if (!result || result.length > 128 || /\s/.test(result)) throw new Error('AI_KNOWLEDGE_INVALID_HASH');
  return result;
}

export async function syncKnowledgeSourceWithDeps(
  input: KnowledgeSourceInput,
  actor: KnowledgeActor,
  deps: KnowledgeSyncDeps,
): Promise<KnowledgeSyncResult> {
  if (!canSyncAiKnowledge(actor.role)) throw new Error('AI_KNOWLEDGE_FORBIDDEN');
  const sourceId = cleanId(input.driveFileId);
  const title = cleanTitle(input.title);
  const contentHash = cleanVersionHash(input.contentHash);
  const existing = await deps.readManifest(sourceId);
  if (existing?.contentHash === contentHash && existing.status === 'ready') {
    return { sourceId, providerDocumentId: existing.providerDocumentId, status: 'unchanged' };
  }
  const uploaded = await deps.uploadToFileSearch({ ...input, driveFileId: sourceId, title, contentHash });
  if (!uploaded.providerDocumentId) throw new Error('AI_FILE_SEARCH_DOCUMENT_MISSING');
  await deps.writeManifest(sourceId, {
    sourceId, title, contentHash, providerDocumentId: uploaded.providerDocumentId, status: 'ready',
  });
  if (existing?.providerDocumentId && existing.providerDocumentId !== uploaded.providerDocumentId && deps.deleteFromFileSearch) {
    try { await deps.deleteFromFileSearch(existing.providerDocumentId); } catch { /* cleanup is retryable */ }
  }
  return { sourceId, providerDocumentId: uploaded.providerDocumentId, status: 'synced' };
}

interface DriveMetadata {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  parents?: string[];
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`AI_KNOWLEDGE_CONFIG_MISSING ${name}`);
  return value;
}

async function driveAccessToken(): Promise<string> {
  const scope = 'https://www.googleapis.com/auth/drive.readonly';
  if (process.env.VERCEL === '1') {
    const [{ getVercelOidcToken }, { ExternalAccountClient }] = await Promise.all([
      import('@vercel/oidc'), import('google-auth-library'),
    ]);
    const projectNumber = requiredEnv('GCP_PROJECT_NUMBER');
    const serviceAccountEmail = requiredEnv('GCP_SERVICE_ACCOUNT_EMAIL');
    const poolId = requiredEnv('GCP_WORKLOAD_IDENTITY_POOL_ID');
    const providerId = requiredEnv('GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID');
    const audience = `https://iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`;
    const client = ExternalAccountClient.fromJSON({
      type: 'external_account', audience,
      subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
      token_url: 'https://sts.googleapis.com/v1/token',
      service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
      subject_token_supplier: { getSubjectToken: () => getVercelOidcToken({ audience }) },
    });
    if (!client) throw new Error('AI_DRIVE_AUTH_INIT_FAILED');
    client.scopes = [scope];
    const access = await client.getAccessToken();
    if (!access.token) throw new Error('AI_DRIVE_AUTH_TOKEN_MISSING');
    return access.token;
  }
  const { GoogleAuth } = await import('google-auth-library');
  const client = await new GoogleAuth({ scopes: [scope] }).getClient();
  const access = await client.getAccessToken();
  if (!access.token) throw new Error('AI_DRIVE_AUTH_TOKEN_MISSING');
  return access.token;
}

async function driveFetch(path: string, token: string): Promise<Response> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
  });
  if (!response.ok) throw new Error(`AI_DRIVE_REQUEST_FAILED ${response.status}`);
  return response;
}

async function readApprovedDriveFile(driveFileId: string) {
  const token = await driveAccessToken();
  const sourceId = cleanId(driveFileId);
  const folderId = requiredEnv('AI_DRIVE_FOLDER_ID');
  const metadata = await (await driveFetch(
    `files/${encodeURIComponent(sourceId)}?fields=id,name,mimeType,modifiedTime,parents&supportsAllDrives=true`, token,
  )).json() as DriveMetadata;
  if (!metadata.parents?.includes(folderId)) throw new Error('AI_DRIVE_SOURCE_OUTSIDE_APPROVED_FOLDER');

  let contentResponse: Response;
  let uploadMimeType = metadata.mimeType;
  if (metadata.mimeType === 'application/vnd.google-apps.document') {
    uploadMimeType = 'text/plain';
    contentResponse = await driveFetch(
      `files/${encodeURIComponent(sourceId)}/export?mimeType=${encodeURIComponent(uploadMimeType)}`, token,
    );
  } else {
    const allowed = new Set([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'text/markdown',
    ]);
    if (!allowed.has(metadata.mimeType)) throw new Error('AI_DRIVE_UNSUPPORTED_MIME');
    contentResponse = await driveFetch(`files/${encodeURIComponent(sourceId)}?alt=media&supportsAllDrives=true`, token);
  }
  const bytes = new Uint8Array(await contentResponse.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > 20 * 1024 * 1024) throw new Error('AI_DRIVE_FILE_SIZE_INVALID');
  return { metadata, bytes, uploadMimeType };
}

function stableArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function uploadBytesToFileSearch(input: { bytes: Uint8Array; mimeType: string; title: string }) {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: requiredEnv('GEMINI_API_KEY') });
  let operation = await ai.fileSearchStores.uploadToFileSearchStore({
    fileSearchStoreName: requiredEnv('GEMINI_FILE_SEARCH_STORE'),
    file: new Blob([stableArrayBuffer(input.bytes)], { type: input.mimeType }),
    config: { displayName: input.title },
  });
  for (let attempt = 0; !operation.done && attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    operation = await ai.operations.get({ operation });
  }
  if (!operation.done) throw new Error('AI_FILE_SEARCH_UPLOAD_TIMEOUT');
  if (operation.error) throw new Error('AI_FILE_SEARCH_UPLOAD_FAILED');
  const response = operation.response as unknown as { documentName?: string; name?: string } | undefined;
  const providerDocumentId = response?.documentName || response?.name;
  if (!providerDocumentId) throw new Error('AI_FILE_SEARCH_DOCUMENT_MISSING');
  return { providerDocumentId };
}

async function deleteProviderDocument(providerDocumentId: string): Promise<void> {
  if (!providerDocumentId.startsWith('fileSearchStores/')) throw new Error('AI_FILE_SEARCH_DOCUMENT_INVALID');
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: requiredEnv('GEMINI_API_KEY') });
  await ai.fileSearchStores.documents.delete({ name: providerDocumentId, config: { force: true } });
}

export async function syncDriveSource(input: { driveFileId: string }, actor: KnowledgeActor): Promise<KnowledgeSyncResult> {
  if (!canSyncAiKnowledge(actor.role)) throw new Error('AI_KNOWLEDGE_FORBIDDEN');
  const { metadata, bytes, uploadMimeType } = await readApprovedDriveFile(input.driveFileId);
  const contentHash = createHash('sha256').update(bytes).digest('hex');
  const { adminDb } = await import('./firebase-admin');
  const db = adminDb();
  return syncKnowledgeSourceWithDeps(
    { driveFileId: metadata.id, title: metadata.name, contentHash }, actor,
    {
      async readManifest(sourceId) {
        const snapshot = await db.collection('aiKnowledgeSources').doc(sourceId).get();
        if (!snapshot.exists) return null;
        const data = snapshot.data() ?? {};
        if (typeof data.sourceId !== 'string' || typeof data.title !== 'string' || typeof data.contentHash !== 'string'
          || typeof data.providerDocumentId !== 'string' || data.status !== 'ready') return null;
        return {
          sourceId: data.sourceId, title: data.title, contentHash: data.contentHash,
          providerDocumentId: data.providerDocumentId, status: 'ready',
          mimeType: typeof data.mimeType === 'string' ? data.mimeType : undefined,
          driveModifiedTime: typeof data.driveModifiedTime === 'string' ? data.driveModifiedTime : undefined,
        };
      },
      async writeManifest(sourceId, value) {
        const { FieldValue } = await import('firebase-admin/firestore');
        await db.collection('aiKnowledgeSources').doc(sourceId).set({
          ...value, mimeType: uploadMimeType, driveModifiedTime: metadata.modifiedTime ?? null,
          updatedAt: FieldValue.serverTimestamp(), syncedBy: actor.uid,
        });
      },
      uploadToFileSearch: async ({ title }) => uploadBytesToFileSearch({ bytes, mimeType: uploadMimeType, title }),
      deleteFromFileSearch: deleteProviderDocument,
    },
  );
}

export async function removeKnowledgeSource(sourceId: string, actor: KnowledgeActor): Promise<void> {
  if (!canDeleteAiKnowledge(actor.role)) throw new Error('AI_KNOWLEDGE_FORBIDDEN');
  const safeId = cleanId(sourceId);
  const { adminDb } = await import('./firebase-admin');
  const ref = adminDb().collection('aiKnowledgeSources').doc(safeId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error('AI_KNOWLEDGE_NOT_FOUND');
  const providerDocumentId = snapshot.data()?.providerDocumentId;
  if (typeof providerDocumentId !== 'string' || !providerDocumentId) throw new Error('AI_KNOWLEDGE_MANIFEST_INVALID');
  await deleteProviderDocument(providerDocumentId);
  await ref.delete();
}

export async function listKnowledgeSources(limit = 50) {
  const bounded = Math.max(1, Math.min(50, Math.trunc(limit)));
  const { adminDb } = await import('./firebase-admin');
  const snapshot = await adminDb().collection('aiKnowledgeSources').orderBy('updatedAt', 'desc').limit(bounded).get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      sourceId: doc.id,
      title: typeof data.title === 'string' ? data.title : 'Untitled',
      status: data.status === 'ready' ? 'ready' : 'error',
      mimeType: typeof data.mimeType === 'string' ? data.mimeType : '',
      driveModifiedTime: typeof data.driveModifiedTime === 'string' ? data.driveModifiedTime : null,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? null,
    };
  });
}
