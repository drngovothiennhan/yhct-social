import { getPublicRecoveryState } from '@/lib/server/recovery-public';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const state = await getPublicRecoveryState();
  return Response.json(state, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
