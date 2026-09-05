import { getVercelOidcToken } from '@vercel/oidc';
import { ExternalAccountClient } from 'google-auth-library';
import { applicationDefault, getApps, initializeApp, type App, type Credential } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'yhct-social-260902-42a4';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`ROOT_CONFIG_MISSING ${name}`);
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
        subject_token_supplier: { getSubjectToken: () => getVercelOidcToken({ audience }) },
      });
      if (!client) throw new Error('ROOT_OIDC_CLIENT_INIT_FAILED');
      const access = await client.getAccessToken();
      if (!access.token) throw new Error('ROOT_OIDC_ACCESS_TOKEN_MISSING');
      return { access_token: access.token, expires_in: 3600 };
    },
  };
}

function resolveCredential(): Credential {
  return process.env.VERCEL === '1' ? vercelOidcCredential() : applicationDefault();
}

export function getRootAdminApp(): App {
  return getApps()[0] ?? initializeApp({ projectId: PROJECT_ID, credential: resolveCredential() });
}

export function rootAdminAuth() {
  return getAuth(getRootAdminApp());
}

export function rootAdminDb() {
  return getFirestore(getRootAdminApp());
}
