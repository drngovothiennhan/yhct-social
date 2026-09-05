import { AccHttpError, accErrorResponse, requireAccRole } from '@/lib/admin-auth';
import { adminBucket, adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function safeUid(value: string): string {
  const uid = value.trim();
  if (!uid || uid.length > 128 || uid.includes('/') || uid.includes('\\')) {
    throw new AccHttpError(400, 'INVALID_UID');
  }
  return uid;
}

function safeEvidencePath(uid: string, value: string | null): string {
  const path = (value ?? '').trim();
  const prefix = `certificates/${uid}/`;
  if (!path || path.length > 512 || !path.startsWith(prefix) || path.includes('..') || path.includes('\\')) {
    throw new AccHttpError(400, 'INVALID_EVIDENCE_PATH');
  }
  const fileName = path.slice(prefix.length);
  if (!fileName || fileName.includes('/')) throw new AccHttpError(400, 'INVALID_EVIDENCE_PATH');
  return path;
}

function safeFileName(path: string): string {
  return (path.split('/').pop() ?? 'evidence')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .slice(0, 180) || 'evidence';
}

export async function GET(
  request: Request,
  context: { params: Promise<{ uid: string }> },
) {
  try {
    await requireAccRole(request, 'super_mod');
    const { uid: rawUid } = await context.params;
    const uid = safeUid(rawUid);
    const url = new URL(request.url);
    const storagePath = safeEvidencePath(uid, url.searchParams.get('path'));

    const requestSnapshot = await adminDb().doc(`verificationRequests/${uid}`).get();
    if (!requestSnapshot.exists) throw new AccHttpError(404, 'EVIDENCE_NOT_FOUND');

    const data = requestSnapshot.data() as Record<string, unknown>;
    const evidence = Array.isArray(data.evidence) ? data.evidence : [];
    const registered = evidence.some((item) => {
      if (!item || typeof item !== 'object') return false;
      return (item as Record<string, unknown>).storagePath === storagePath;
    });
    if (!registered) throw new AccHttpError(404, 'EVIDENCE_NOT_FOUND');

    const file = adminBucket().file(storagePath);
    const [[buffer], [metadata]] = await Promise.all([
      file.download(),
      file.getMetadata(),
    ]).catch(() => {
      throw new AccHttpError(404, 'EVIDENCE_NOT_FOUND');
    });

    const contentType = ALLOWED_CONTENT_TYPES.has(String(metadata.contentType ?? ''))
      ? String(metadata.contentType)
      : 'application/octet-stream';

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${safeFileName(storagePath)}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return accErrorResponse(error);
  }
}
