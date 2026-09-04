'use client';

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import {
  buildPostPayload,
  type PostDraft,
} from '@/lib/domain/post';
import {
  buildSocialPostPayload,
  type SocialPostDraft,
} from '@/lib/domain/social';
import {
  deleteStoragePaths,
  uploadPostImages,
  uploadSocialPostImages,
  type UploadProgressHandler,
} from '@/lib/storage-service';
import type { ClubRole } from '@/lib/domain/rbac';
import type { PostRecord, PostType, SocialPostRecord, UserProfile } from '@/lib/types';

export const SOCIAL_FEED_PAGE_SIZE = 20;
export type SocialFeedFilter = 'all' | 'club' | 'members';

function toPostRecord(snapshot: { id: string; data: () => unknown }): PostRecord {
  return { id: snapshot.id, ...(snapshot.data() as Omit<PostRecord, 'id'>) };
}

function toSocialPostRecord(snapshot: { id: string; data: () => unknown }): SocialPostRecord {
  return { id: snapshot.id, ...(snapshot.data() as Omit<SocialPostRecord, 'id'>) };
}

export async function createSocialPost(input: {
  profile: UserProfile;
  claims: { role: ClubRole; clubMember: boolean; mustChangePassword: boolean };
  draft: SocialPostDraft;
  files: File[];
  onUploadProgress?: UploadProgressHandler;
}): Promise<string> {
  const user = auth.currentUser;
  if (!user || user.uid !== input.profile.uid) {
    throw new Error('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
  }
  if (!input.claims.clubMember || input.claims.mustChangePassword) {
    throw new Error('Tài khoản chưa đủ điều kiện đăng nội dung cộng đồng.');
  }

  const postRef = doc(collection(db, 'posts'));
  let uploadedPaths: string[] = [];

  try {
    const media = await uploadSocialPostImages({
      uid: user.uid,
      postId: postRef.id,
      files: input.files,
      onProgress: input.onUploadProgress,
    });
    uploadedPaths = media.map((item) => item.storagePath);

    const payload = buildSocialPostPayload(
      { ...input.draft, media },
      {
        uid: user.uid,
        displayName: input.profile.displayName,
        photoURL: input.profile.photoURL,
        role: input.claims.role,
      },
    );

    await setDoc(postRef, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return postRef.id;
  } catch (error) {
    if (uploadedPaths.length > 0) await deleteStoragePaths(uploadedPaths);
    throw error;
  }
}

export async function loadFeedPage(input: {
  filter?: SocialFeedFilter;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
  pageSize?: number;
  authorId?: string;
  activityId?: string;
} = {}): Promise<{
  posts: SocialPostRecord[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}> {
  const pageSize = Math.max(1, Math.min(SOCIAL_FEED_PAGE_SIZE, input.pageSize ?? SOCIAL_FEED_PAGE_SIZE));
  const constraints: QueryConstraint[] = [where('status', '==', 'active')];

  if (input.authorId) constraints.push(where('authorId', '==', input.authorId));
  else if (input.activityId) constraints.push(where('activityId', '==', input.activityId));
  else if (input.filter === 'club') constraints.push(where('kind', 'in', ['club_news', 'activity_update']));
  else if (input.filter === 'members') constraints.push(where('kind', '==', 'member_post'));

  constraints.push(orderBy('createdAt', 'desc'));
  if (input.cursor) constraints.push(startAfter(input.cursor));
  constraints.push(limit(pageSize));

  const snapshot = await getDocs(query(collection(db, 'posts'), ...constraints));
  return {
    posts: snapshot.docs.map(toSocialPostRecord),
    cursor: snapshot.docs.at(-1) ?? null,
    hasMore: snapshot.size === pageSize,
  };
}

export async function loadSocialPost(postId: string): Promise<SocialPostRecord | null> {
  const snapshot = await getDoc(doc(db, 'posts', postId));
  if (!snapshot.exists() || !('kind' in snapshot.data())) return null;
  return toSocialPostRecord(snapshot);
}

// Legacy v1 publisher/feeds retained until Module B UI fully replaces them.
export async function createPost(input: {
  profile: UserProfile;
  draft: PostDraft;
  files: File[];
  onUploadProgress?: UploadProgressHandler;
}): Promise<string> {
  const user = auth.currentUser;
  if (!user || user.uid !== input.profile.uid) throw new Error('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
  const postRef = doc(collection(db, 'posts'));
  let mediaPaths: string[] = [];
  try {
    mediaPaths = await uploadPostImages({ uid: user.uid, postId: postRef.id, files: input.files, onProgress: input.onUploadProgress });
    const payload = buildPostPayload(input.draft, {
      uid: input.profile.uid,
      displayName: input.profile.displayName,
      photoURL: input.profile.photoURL,
      professionalTitle: input.profile.professionalTitle,
      accountType: input.profile.accountType,
      verificationStatus: input.profile.verificationStatus,
    }, mediaPaths);
    await setDoc(postRef, { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return postRef.id;
  } catch (error) {
    if (mediaPaths.length > 0) await deleteStoragePaths(mediaPaths);
    throw error;
  }
}

export function subscribePublishedPosts(
  postType: PostType | 'all',
  onPosts: (posts: PostRecord[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const constraints: QueryConstraint[] = [where('status', '==', 'published')];
  if (postType !== 'all') constraints.push(where('type', '==', postType));
  const feedQuery = query(collection(db, 'posts'), ...constraints, orderBy('createdAt', 'desc'), limit(20));
  return onSnapshot(feedQuery, (snapshot) => onPosts(snapshot.docs.map(toPostRecord)), onError);
}

export function subscribeLikes(
  postId: string,
  currentUid: string | null,
  onChange: (state: { count: number; likedByCurrentUser: boolean }) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(collection(db, 'posts', postId, 'likes'), (snapshot) => {
    onChange({ count: snapshot.size, likedByCurrentUser: currentUid !== null && snapshot.docs.some((item) => item.id === currentUid) });
  }, (error) => onError?.(error));
}

export async function togglePostLike(postId: string, uid: string, currentlyLiked: boolean): Promise<void> {
  const likeRef = doc(db, 'posts', postId, 'likes', uid);
  if (currentlyLiked) {
    await deleteDoc(likeRef);
    return;
  }
  const existing = await getDoc(likeRef);
  if (existing.exists()) return;
  await setDoc(likeRef, { userId: uid, createdAt: serverTimestamp() });
}
