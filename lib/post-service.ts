'use client';

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import {
  buildPostPayload,
  type PostDraft,
} from '@/lib/domain/post';
import {
  deleteStoragePaths,
  uploadPostImages,
  type UploadProgressHandler,
} from '@/lib/storage-service';
import type { PostRecord, PostType, UserProfile } from '@/lib/types';

function toPostRecord(snapshot: { id: string; data: () => unknown }): PostRecord {
  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<PostRecord, 'id'>),
  };
}

export async function createPost(input: {
  profile: UserProfile;
  draft: PostDraft;
  files: File[];
  onUploadProgress?: UploadProgressHandler;
}): Promise<string> {
  const user = auth.currentUser;
  if (!user || user.uid !== input.profile.uid) {
    throw new Error('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
  }

  const postRef = doc(collection(db, 'posts'));
  let mediaPaths: string[] = [];

  try {
    mediaPaths = await uploadPostImages({
      uid: user.uid,
      postId: postRef.id,
      files: input.files,
      onProgress: input.onUploadProgress,
    });

    const payload = buildPostPayload(
      input.draft,
      {
        uid: input.profile.uid,
        displayName: input.profile.displayName,
        photoURL: input.profile.photoURL,
        professionalTitle: input.profile.professionalTitle,
        accountType: input.profile.accountType,
        verificationStatus: input.profile.verificationStatus,
      },
      mediaPaths,
    );

    await setDoc(postRef, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return postRef.id;
  } catch (error) {
    if (mediaPaths.length > 0) {
      await deleteStoragePaths(mediaPaths);
    }
    throw error;
  }
}

export function subscribePublishedPosts(
  postType: PostType | 'all',
  onPosts: (posts: PostRecord[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const postsRef = collection(db, 'posts');
  const constraints = [where('status', '==', 'published')];

  if (postType !== 'all') {
    constraints.push(where('type', '==', postType));
  }

  const feedQuery = query(
    postsRef,
    ...constraints,
    orderBy('createdAt', 'desc'),
    limit(20),
  );

  return onSnapshot(
    feedQuery,
    (snapshot) => onPosts(snapshot.docs.map(toPostRecord)),
    (error) => onError(error),
  );
}

export function subscribeLikes(
  postId: string,
  currentUid: string | null,
  onChange: (state: { count: number; likedByCurrentUser: boolean }) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'posts', postId, 'likes'),
    (snapshot) => {
      onChange({
        count: snapshot.size,
        likedByCurrentUser:
          currentUid !== null && snapshot.docs.some((item) => item.id === currentUid),
      });
    },
    (error) => onError?.(error),
  );
}

export async function togglePostLike(
  postId: string,
  uid: string,
  currentlyLiked: boolean,
): Promise<void> {
  const likeRef = doc(db, 'posts', postId, 'likes', uid);

  if (currentlyLiked) {
    await deleteDoc(likeRef);
    return;
  }

  const existing = await getDoc(likeRef);
  if (existing.exists()) return;

  await setDoc(likeRef, {
    userId: uid,
    createdAt: serverTimestamp(),
  });
}
