'use client';

import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export interface RecognitionRecord {
  id: string;
  memberId: string;
  title: string;
  reason: string;
  sourcePostIds: string[];
  sourceScore: number;
  activityCount: number;
  status: 'proposed' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: unknown;
  createdAt: unknown;
}

export interface RecognitionCandidate {
  memberId: string;
  publishedPostCount: number;
  scoreTotal: number;
  activityCount: number;
  weightedScore: number;
}

export function computeRecognitionCandidate(input: Omit<RecognitionCandidate, 'weightedScore'>): RecognitionCandidate {
  return {
    ...input,
    weightedScore: input.publishedPostCount * 8 + input.scoreTotal + input.activityCount * 5,
  };
}

export async function loadMyRecognitions(): Promise<RecognitionRecord[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('AUTH_REQUIRED');
  const snapshot = await getDocs(query(
    collection(db, 'recognitions'),
    where('memberId', '==', uid),
    where('status', '==', 'approved'),
    orderBy('createdAt', 'desc'),
    limit(50),
  ));
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<RecognitionRecord, 'id'>) }));
}
