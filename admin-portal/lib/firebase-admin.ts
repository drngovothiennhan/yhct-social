import { getVercelOidcToken } from '@vercel/oidc';
import { ExternalAccountClient } from 'google-auth-library';
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
  type Credential,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'yhct-social-260902-42a4';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`ACC_CONFIG_MISSING ${name}`);
  return value;
}

function vercelOidcCredential(): Credential {
  const projectNumber = requireEnv('GCP_PROJECT_NUMBER');
  const serviceAccountEmail = requireEnv('GCP_SERVICE_ACCOUNT_EMAIL');
  const poolId = requireEnv('GCP_WORKLOAD_IDENTITY_POOL_ID');
  const providerId = requireEnv('GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID');
  const audience = `https://iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`;

  return {
    async getAccessToken() {
      const client = ExternalAccountClient.fromJSON({
        type: 'external_account',
        audience,
        subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
        token_url: 'https://sts.googleapis.com/v1/token',
        service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
        subject_token_supplier: {
          getSubjectToken: () => getVercelOidcToken({ audience }),
        },
      });
      if (!client) throw new Error('ACC_OIDC_CLIENT_INIT_FAILED');
      const access = await client.getAccessToken();
      if (!access.token) throw new Error('ACC_OIDC_ACCESS_TOKEN_MISSING');
      return { access_token: access.token, expires_in: 3600 };
    },
  };
}

function resolveCredential(): Credential {
  if (process.env.VERCEL === '1') return vercelOidcCredential();
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
    if (parsed.project_id !== PROJECT_ID) throw new Error('ACC_FIREBASE_PROJECT_MISMATCH');
    return cert(parsed);
  }
  return applicationDefault();
}

export function getAdminApp(): App {
  return getApps()[0] ?? initializeApp({ projectId: PROJECT_ID, credential: resolveCredential() });
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminDb() {
  return getFirestore(getAdminApp());
}
