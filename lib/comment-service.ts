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
import { validateCommentText } from '@/lib/domain/social';
import type { CommentRecord, SocialCommentRecord, UserProfile } from '@/lib/types';

function toCommentRecord(snapshot: { id: string; data: () => unknown }): CommentRecord {
  return { id: snapshot.id, ...(snapshot.data() as Omit<CommentRecord, 'id'>) };
}

function toSocialCommentRecord(
  postId: string,
  snapshot: { id: string; data: () => unknown },
): SocialCommentRecord {
  return { id: snapshot.id, postId, ...(snapshot.data() as Omit<SocialCommentRecord, 'id' | 'postId'>) };
}

export function subscribeSocialPostComments(
  postId: string,
  onComments: (comments: SocialCommentRecord[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const commentsQuery = query(
    collection(db, 'posts', postId, 'comments'),
    where('status', 'in', ['active', 'deleted']),
    orderBy('createdAt', 'asc'),
  );
  return onSnapshot(
    commentsQuery,
    (snapshot) => onComments(snapshot.docs.map((item) => toSocialCommentRecord(postId, item))),
    onError,
  );
}

export async function createPostComment(input: {
  postId: string;
  profile: UserProfile;
  text: string;
}): Promise<string> {
  const user = auth.currentUser;
  if (!user || user.uid !== input.profile.uid) throw new Error('Bạn cần đăng nhập để thảo luận.');
  const validation = validateCommentText(input.text);
  if (!validation.ok) throw new Error(validation.message);

  const comment = await addDoc(collection(db, 'posts', input.postId, 'comments'), {
    authorId: user.uid,
    authorNameSnapshot: input.profile.displayName,
    authorPhotoSnapshot: input.profile.photoURL || null,
    text: input.text.trim(),
    edited: false,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return comment.id;
}

export async function editPostComment(postId: string, commentId: string, text: string): Promise<void> {
  const validation = validateCommentText(text);
  if (!validation.ok) throw new Error(validation.message);
  await updateDoc(doc(db, 'posts', postId, 'comments', commentId), {
    text: text.trim(),
    edited: true,
    status: 'active',
    updatedAt: serverTimestamp(),
  });
}

export async function softDeletePostComment(postId: string, commentId: string): Promise<void> {
  await updateDoc(doc(db, 'posts', postId, 'comments', commentId), {
    text: '',
    edited: true,
    status: 'deleted',
    updatedAt: serverTimestamp(),
  });
}

// Legacy v1 comment API retained during transition.
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
  return onSnapshot(commentsQuery, (snapshot) => onComments(snapshot.docs.map(toCommentRecord)), onError);
}

export async function createComment(input: {
  profile: UserProfile;
  postId: string;
  content: string;
  parent?: Pick<CommentRecord, 'id' | 'depth'> | null;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.uid !== input.profile.uid) throw new Error('Bạn cần đăng nhập để thảo luận.');
  const content = input.content.trim();
  if (!content || content.length > 4000) throw new Error('Bình luận phải có từ 1 đến 4.000 ký tự.');
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
