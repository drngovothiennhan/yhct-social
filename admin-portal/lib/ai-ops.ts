import { adminDb } from './firebase-admin';

export interface AiAnalysisRow {
  id: string;
  targetType: string;
  targetId: string | null;
  category: string;
  confidence: number;
  safetySignals: string[];
  rationale: string;
  requesterUid: string | null;
  modelVersion: string | null;
  createdAt: string | null;
}

function iso(value: unknown): string | null {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate(): Date }).toDate().toISOString();
  }
  return null;
}

export async function listAiAnalyses(input: {
  limit?: number;
  cursor?: string;
  category?: string;
  safetySignal?: string;
} = {}): Promise<{ analyses: AiAnalysisRow[]; nextCursor: string | null }> {
  const bounded = Math.max(1, Math.min(50, Math.trunc(input.limit ?? 30)));
  const db = adminDb();
  let query = db.collection('aiAnalyses').orderBy('createdAt', 'desc').limit(bounded + 1);
  if (input.cursor) {
    const cursorSnapshot = await db.collection('aiAnalyses').doc(input.cursor).get();
    if (cursorSnapshot.exists) query = query.startAfter(cursorSnapshot);
  }
  const snapshot = await query.get();
  const docs = snapshot.docs.slice(0, bounded);
  const rows = docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      targetType: typeof data.targetType === 'string' ? data.targetType : 'unknown',
      targetId: typeof data.targetId === 'string' ? data.targetId : null,
      category: typeof data.category === 'string' ? data.category : 'other',
      confidence: typeof data.confidence === 'number' ? data.confidence : 0,
      safetySignals: Array.isArray(data.safetySignals) ? data.safetySignals.filter((value): value is string => typeof value === 'string').slice(0, 20) : [],
      rationale: typeof data.rationale === 'string' ? data.rationale.slice(0, 1200) : '',
      requesterUid: typeof data.requesterUid === 'string' ? data.requesterUid : null,
      modelVersion: typeof data.modelVersion === 'string' ? data.modelVersion : null,
      createdAt: iso(data.createdAt),
    } satisfies AiAnalysisRow;
  }).filter((row) => (!input.category || row.category === input.category)
    && (!input.safetySignal || row.safetySignals.includes(input.safetySignal)));
  return {
    analyses: rows,
    nextCursor: snapshot.docs.length > bounded ? docs.at(-1)?.id ?? null : null,
  };
}

export async function getAiQuotaSummary(): Promise<{ dateKey: string; count: number }> {
  const dateKey = new Date().toISOString().slice(0, 10);
  const snapshot = await adminDb().collection('aiQuotaDaily').doc(dateKey).get();
  const count = Number(snapshot.data()?.count ?? 0);
  return { dateKey, count: Number.isFinite(count) && count >= 0 ? count : 0 };
}
