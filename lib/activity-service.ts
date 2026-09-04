'use client';

import { collection, doc, getDoc, getDocs, limit, query, where, type Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { loadFeedPage } from '@/lib/post-service';
import type { SocialPostRecord } from '@/lib/types';

export const ACTIVITY_PAGE_SIZE = 30;

export interface ActivityRecord {
  id: string;
  title: string;
  description: string;
  startAt: Timestamp | null;
  endAt: Timestamp | null;
  location: string;
  coverImageURL: string;
  status: string;
  createdBy?: string;
}

function toActivity(id: string, data: Record<string, unknown>): ActivityRecord {
  return {
    id,
    title: String(data.title ?? data.name ?? 'Hoạt động CLB'),
    description: String(data.description ?? data.note ?? ''),
    startAt: (data.startAt ?? data.eventDate ?? null) as Timestamp | null,
    endAt: (data.endAt ?? null) as Timestamp | null,
    location: String(data.location ?? ''),
    coverImageURL: String(data.coverImageURL ?? ''),
    status: String(data.status ?? ''),
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : undefined,
  };
}

export async function loadActivities(): Promise<ActivityRecord[]> {
  const snapshot = await getDocs(query(
    collection(db, 'activities'),
    where('status', '==', 'published'),
    limit(ACTIVITY_PAGE_SIZE),
  ));
  return snapshot.docs
    .map((item) => toActivity(item.id, item.data()))
    .sort((a, b) => (b.startAt?.toMillis?.() ?? 0) - (a.startAt?.toMillis?.() ?? 0));
}

export async function loadActivity(activityId: string): Promise<ActivityRecord | null> {
  const snapshot = await getDoc(doc(db, 'activities', activityId));
  if (!snapshot.exists() || snapshot.data().status !== 'published') return null;
  return toActivity(snapshot.id, snapshot.data());
}

export async function loadActivityRelatedPosts(activityId: string): Promise<SocialPostRecord[]> {
  const page = await loadFeedPage({ activityId, pageSize: 10 });
  return page.posts;
}
