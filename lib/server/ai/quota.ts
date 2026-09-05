import { createHash } from 'node:crypto';
import type { AiActor, AiOperation } from './types.ts';

export interface QuotaDecision {
  allowed: boolean;
  reason?: 'user_window' | 'daily_global';
  remaining?: number;
}

export function makeAiCacheKey(kind: string, contentHash: string, modelVersion: string): string {
  return createHash('sha256')
    .update(`${kind}\u0000${contentHash}\u0000${modelVersion}`, 'utf8')
    .digest('hex');
}

export function makeQuotaWindowKey(date = new Date()): string {
  return date.toISOString().slice(0, 13);
}

export function decideQuotaCounts(input: {
  userCount: number;
  dailyCount: number;
  perUserLimit: number;
  dailyLimit: number;
}): QuotaDecision {
  if (input.userCount >= input.perUserLimit) return { allowed: false, reason: 'user_window' };
  if (input.dailyCount >= input.dailyLimit) return { allowed: false, reason: 'daily_global' };
  return { allowed: true, remaining: Math.max(0, input.perUserLimit - input.userCount - 1) };
}

export async function consumeAiQuota(actor: AiActor, operation: AiOperation): Promise<QuotaDecision> {
  const [{ rootAdminDb }, { getAiConfig }, firestore] = await Promise.all([
    import('../firebase-admin.ts'),
    import('./config.ts'),
    import('firebase-admin/firestore'),
  ]);
  const config = getAiConfig();
  const db = rootAdminDb();
  const now = new Date();
  const dailyKey = now.toISOString().slice(0, 10);
  const windowKey = makeQuotaWindowKey(now);
  const dailyRef = db.collection('aiQuotaDaily').doc(dailyKey);
  const windowRef = db.collection('aiQuotaWindows').doc(`${actor.uid}__${windowKey}`);

  return db.runTransaction(async (transaction) => {
    const [dailySnapshot, windowSnapshot] = await Promise.all([
      transaction.get(dailyRef),
      transaction.get(windowRef),
    ]);
    const dailyCount = Number(dailySnapshot.data()?.count ?? 0);
    const userCount = Number(windowSnapshot.data()?.count ?? 0);
    const decision = decideQuotaCounts({
      userCount,
      dailyCount,
      perUserLimit: config.perUserWindowLimit,
      dailyLimit: config.dailyRequestLimit,
    });
    if (!decision.allowed) return decision;

    const common = { updatedAt: firestore.FieldValue.serverTimestamp() };
    transaction.set(dailyRef, {
      count: dailyCount + 1,
      dateKey: dailyKey,
      lastOperation: operation,
      ...common,
    }, { merge: true });
    transaction.set(windowRef, {
      uid: actor.uid,
      count: userCount + 1,
      windowKey,
      lastOperation: operation,
      ...common,
    }, { merge: true });
    return decision;
  });
}
