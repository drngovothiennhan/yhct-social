export interface ManagedBackupSummary {
  id: string;
  state: string;
  databaseId: string;
  snapshotTime: string | null;
  expireTime: string | null;
}

export interface ProviderOperationSummary {
  operationId: string;
  done: boolean;
  errorCode?: string;
}

interface ProviderRequestInit {
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  token?: string;
}

export interface RecoveryProviderDeps {
  projectId: string;
  databaseId: string;
  location: string;
  bucket: string;
  prefix: string;
  accessToken(): Promise<string>;
  fetchJson(path: string, init: ProviderRequestInit): Promise<unknown>;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`RECOVERY_CONFIG_MISSING ${name}`);
  return value;
}

function safeSegment(value: string, code: string): string {
  const result = value.trim();
  if (!result || result.length > 180 || !/^[A-Za-z0-9._()\-]+$/.test(result)) throw new Error(code);
  return result;
}

function resourceSuffix(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  return value.split('/').filter(Boolean).at(-1) ?? '';
}

function databaseSuffix(value: unknown): string {
  if (typeof value !== 'string') return '';
  const marker = '/databases/';
  const at = value.lastIndexOf(marker);
  return at >= 0 ? value.slice(at + marker.length).split('/')[0] ?? '' : resourceSuffix(value);
}

function operationSummary(value: unknown): ProviderOperationSummary {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const error = row.error && typeof row.error === 'object' ? row.error as Record<string, unknown> : undefined;
  const operationId = resourceSuffix(row.name);
  if (!operationId) throw new Error('RECOVERY_PROVIDER_OPERATION_MISSING');
  return {
    operationId,
    done: row.done === true,
    ...(error?.code !== undefined ? { errorCode: String(error.code) } : {}),
  };
}

function checkpointId(value: string): string {
  return safeSegment(value, 'RECOVERY_CHECKPOINT_INVALID');
}

function normalizedCollections(values?: string[]): string[] | undefined {
  if (!values?.length) return undefined;
  const cleaned = [...new Set(values.map((value) => safeSegment(value, 'RECOVERY_COLLECTION_INVALID')))];
  if (cleaned.length > 100) throw new Error('RECOVERY_COLLECTION_INVALID');
  return cleaned;
}

export function createRecoveryProviderWithDeps(deps: RecoveryProviderDeps) {
  const projectId = safeSegment(deps.projectId, 'RECOVERY_PROJECT_INVALID');
  const databaseId = safeSegment(deps.databaseId, 'RECOVERY_DATABASE_INVALID');
  const location = safeSegment(deps.location, 'RECOVERY_LOCATION_INVALID');
  const bucket = deps.bucket.trim();
  const prefix = deps.prefix.replace(/^\/+|\/+$/g, '').trim();
  if (!bucket || !/^[A-Za-z0-9._-]+$/.test(bucket)) throw new Error('RECOVERY_BUCKET_INVALID');
  if (!prefix || !/^[A-Za-z0-9._\/-]+$/.test(prefix) || prefix.includes('..')) throw new Error('RECOVERY_PREFIX_INVALID');

  async function request(path: string, init: Omit<ProviderRequestInit, 'token'> = {}): Promise<unknown> {
    const token = await deps.accessToken();
    if (!token) throw new Error('RECOVERY_PROVIDER_AUTH_MISSING');
    return deps.fetchJson(path, { ...init, token });
  }

  return {
    async listManagedBackups(): Promise<ManagedBackupSummary[]> {
      const raw = await request(`projects/${projectId}/locations/${location}/backups`, { method: 'GET' });
      const object = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
      const backups = Array.isArray(object.backups) ? object.backups : [];
      return backups.slice(0, 50).flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const row = item as Record<string, unknown>;
        const id = resourceSuffix(row.name);
        if (!id) return [];
        return [{
          id,
          state: typeof row.state === 'string' ? row.state : 'UNKNOWN',
          databaseId: databaseSuffix(row.database),
          snapshotTime: typeof row.snapshotTime === 'string' ? row.snapshotTime : null,
          expireTime: typeof row.expireTime === 'string' ? row.expireTime : null,
        }];
      });
    },

    async startExportCheckpoint(input: { checkpointId: string; collectionIds?: string[] }): Promise<ProviderOperationSummary> {
      const id = checkpointId(input.checkpointId);
      const collectionIds = normalizedCollections(input.collectionIds);
      const body: Record<string, unknown> = {
        outputUriPrefix: `gs://${bucket}/${prefix}/${id}`,
      };
      if (collectionIds) body.collectionIds = collectionIds;
      const raw = await request(`projects/${projectId}/databases/${databaseId}/exportDocuments`, { method: 'POST', body });
      return operationSummary(raw);
    },

    async startManagedBackupRestore(input: { backupId: string; recoveryDatabaseId: string }): Promise<ProviderOperationSummary> {
      const backupId = safeSegment(input.backupId, 'RECOVERY_BACKUP_NOT_FOUND');
      const recoveryDatabaseId = safeSegment(input.recoveryDatabaseId, 'RECOVERY_TARGET_INVALID');
      const body = {
        backup: `projects/${projectId}/locations/${location}/backups/${backupId}`,
        databaseId: recoveryDatabaseId,
      };
      const raw = await request(`projects/${projectId}/databases:restore`, { method: 'POST', body });
      return operationSummary(raw);
    },

    async startImportToRecoveryDatabase(input: { recoveryDatabaseId: string; inputUriPrefix: string; collectionIds?: string[] }): Promise<ProviderOperationSummary> {
      const recoveryDatabaseId = safeSegment(input.recoveryDatabaseId, 'RECOVERY_TARGET_INVALID');
      if (!input.inputUriPrefix.startsWith(`gs://${bucket}/${prefix}/`)) throw new Error('RECOVERY_CHECKPOINT_INVALID');
      const collectionIds = normalizedCollections(input.collectionIds);
      const body: Record<string, unknown> = { inputUriPrefix: input.inputUriPrefix };
      if (collectionIds) body.collectionIds = collectionIds;
      const raw = await request(`projects/${projectId}/databases/${recoveryDatabaseId}/importDocuments`, { method: 'POST', body });
      return operationSummary(raw);
    },

    async getProviderOperation(operationName: string): Promise<ProviderOperationSummary> {
      const name = operationName.trim().replace(/^\/+/, '');
      if (!name || !/^projects\/[A-Za-z0-9._-]+\/(?:databases|locations)\/.+\/operations\/[A-Za-z0-9._-]+$/.test(name)) {
        throw new Error('RECOVERY_PROVIDER_OPERATION_INVALID');
      }
      return operationSummary(await request(name, { method: 'GET' }));
    },
  };
}

async function recoveryAccessToken(): Promise<string> {
  const scope = 'https://www.googleapis.com/auth/cloud-platform';
  if (process.env.VERCEL === '1') {
    const [{ getVercelOidcToken }, { ExternalAccountClient }] = await Promise.all([
      import('@vercel/oidc'),
      import('google-auth-library'),
    ]);
    const projectNumber = requiredEnv('GCP_PROJECT_NUMBER');
    const serviceAccountEmail = requiredEnv('GCP_SERVICE_ACCOUNT_EMAIL');
    const poolId = requiredEnv('GCP_WORKLOAD_IDENTITY_POOL_ID');
    const providerId = requiredEnv('GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID');
    const audience = `https://iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`;
    const client = ExternalAccountClient.fromJSON({
      type: 'external_account',
      audience,
      subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
      token_url: 'https://sts.googleapis.com/v1/token',
      service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
      subject_token_supplier: { getSubjectToken: () => getVercelOidcToken({ audience }) },
    });
    if (!client) throw new Error('RECOVERY_PROVIDER_AUTH_INIT_FAILED');
    client.scopes = [scope];
    const access = await client.getAccessToken();
    if (!access.token) throw new Error('RECOVERY_PROVIDER_AUTH_MISSING');
    return access.token;
  }
  const { GoogleAuth } = await import('google-auth-library');
  const client = await new GoogleAuth({ scopes: [scope] }).getClient();
  const access = await client.getAccessToken();
  if (!access.token) throw new Error('RECOVERY_PROVIDER_AUTH_MISSING');
  return access.token;
}

async function providerFetchJson(path: string, init: ProviderRequestInit): Promise<unknown> {
  const response = await fetch(`https://firestore.googleapis.com/v1/${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${init.token ?? ''}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`RECOVERY_PROVIDER_UNAVAILABLE ${response.status}`);
  return response.json();
}

export function recoveryProvider() {
  return createRecoveryProviderWithDeps({
    projectId: process.env.RECOVERY_GCP_PROJECT_ID?.trim() || process.env.GOOGLE_CLOUD_PROJECT?.trim() || 'yhct-social-260902-42a4',
    databaseId: process.env.RECOVERY_FIRESTORE_DATABASE_ID?.trim() || '(default)',
    location: requiredEnv('RECOVERY_GCP_LOCATION'),
    bucket: requiredEnv('RECOVERY_EXPORT_BUCKET'),
    prefix: process.env.RECOVERY_EXPORT_PREFIX?.trim() || 'yhct-recovery',
    accessToken: recoveryAccessToken,
    fetchJson: providerFetchJson,
  });
}
