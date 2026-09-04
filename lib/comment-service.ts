'use client';

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { getReplyDepth } from '@/lib/domain/comments';
import type { CommentRecord, UserProfile } from '@/lib/types';

function toCommentRecord(snapshot: { id: string; data: () => unknown }): CommentRecord {
  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<CommentRecord, 'id'>),
  };
}

export function subscribePostComments(
  postId: string,
  onComments: (comments: CommentRecord[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const commentsQuery = query(
    collection(db, 'comments'),
    where('postId', '==', postId),
    where('status', 'in', ['active', 'deleted']),
    orderBy('createdAt', 'asc'),
  );

  return onSnapshot(
    commentsQuery,
    (snapshot) => onComments(snapshot.docs.map(toCommentRecord)),
    (error) => onError(error),
  );
}

export async function createComment(input: {
  profile: UserProfile;
  postId: string;
  content: string;
  parent?: Pick<CommentRecord, 'id' | 'depth'> | null;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.uid !== input.profile.uid) {
    throw new Error('Bạn cần đăng nhập để thảo luận.');
  }

  const content = input.content.trim();
  if (!content || content.length > 4000) {
    throw new Error('Bình luận phải có từ 1 đến 4.000 ký tự.');
  }

  const parentId = input.parent?.id ?? '';
  const depth = input.parent ? getReplyDepth(input.parent.depth) : 0;

  await addDoc(collection(db, 'comments'), {
    postId: input.postId,
    authorId: user.uid,
    authorDisplayName: input.profile.displayName,
    authorPhotoURL: input.profile.photoURL,
    parentId,
    depth,
    content,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function softDeleteOwnComment(commentId: string): Promise<void> {
  await updateDoc(doc(db, 'comments', commentId), {
    content: '',
    status: 'deleted',
    updatedAt: serverTimestamp(),
  });
}
