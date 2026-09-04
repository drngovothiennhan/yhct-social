'use client';

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { normalizeReactionType, type ReactionType } from '@/lib/domain/social';

export interface ReactionState {
  count: number;
  currentType: ReactionType | null;
}

export function subscribePostReactions(
  postId: string,
  currentUid: string | null,
  onChange: (state: ReactionState) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'posts', postId, 'reactions'),
    (snapshot) => {
      const current = currentUid ? snapshot.docs.find((item) => item.id === currentUid) : undefined;
      onChange({
        count: snapshot.size,
        currentType: current ? normalizeReactionType(String(current.data().type ?? '')) : null,
      });
    },
    (error) => onError?.(error),
  );
}

export async function setPostReaction(
  postId: string,
  uid: string,
  value: ReactionType,
): Promise<void> {
  const type = normalizeReactionType(value);
  if (!type) throw new Error('Loại cảm xúc không hợp lệ.');

  const reactionRef = doc(db, 'posts', postId, 'reactions', uid);
  const existing = await getDoc(reactionRef);
  if (existing.exists()) {
    if (normalizeReactionType(String(existing.data().type ?? '')) === type) return;
    await updateDoc(reactionRef, { type, updatedAt: serverTimestamp() });
    return;
  }

  await setDoc(reactionRef, {
    uid,
    type,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function clearPostReaction(postId: string, uid: string): Promise<void> {
  const reactionRef = doc(db, 'posts', postId, 'reactions', uid);
  const existing = await getDoc(reactionRef);
  if (!existing.exists()) return;
  await deleteDoc(reactionRef);
}
