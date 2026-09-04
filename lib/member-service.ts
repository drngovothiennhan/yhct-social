'use client';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserProfile } from '@/lib/types';

export const MEMBER_DIRECTORY_PAGE_SIZE = 50;

export interface SelfProfileInput {
  displayName: string;
  photoURL: string;
  bio: string;
  specialties: string[];
}

function toProfile(id: string, data: Omit<UserProfile, 'uid'>): UserProfile {
  return { uid: id, ...data };
}

export function buildSelfProfileUpdate(input: SelfProfileInput) {
  const displayName = input.displayName.trim();
  if (!displayName || displayName.length > 80) throw new Error('Tên hiển thị phải có từ 1 đến 80 ký tự.');
  const bio = input.bio.trim();
  if (bio.length > 500) throw new Error('Giới thiệu tối đa 500 ký tự.');
  const photoURL = input.photoURL.trim();
  if (photoURL.length > 500) throw new Error('Đường dẫn ảnh đại diện không hợp lệ.');
  const specialties = input.specialties.map((item) => item.trim()).filter(Boolean).slice(0, 12);

  return {
    displayName,
    photoURL,
    bio,
    specialties,
    updatedAt: serverTimestamp(),
  };
}

export async function loadMemberDirectory(): Promise<UserProfile[]> {
  const snapshot = await getDocs(query(
    collection(db, 'users'),
    orderBy('displayName', 'asc'),
    limit(MEMBER_DIRECTORY_PAGE_SIZE),
  ));
  return snapshot.docs.map((item) => toProfile(item.id, item.data() as Omit<UserProfile, 'uid'>));
}

export async function loadMemberProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) return null;
  return toProfile(snapshot.id, snapshot.data() as Omit<UserProfile, 'uid'>);
}

export async function updateSelfProfile(uid: string, input: SelfProfileInput): Promise<void> {
  await updateDoc(doc(db, 'users', uid), buildSelfProfileUpdate(input));
}

export function filterMemberDirectory(members: UserProfile[], term: string): UserProfile[] {
  const needle = term.trim().toLocaleLowerCase('vi');
  if (!needle) return members;
  return members.filter((member) => [
    member.displayName,
    member.professionalTitle,
    member.clubTitle ?? '',
    member.memberCode ?? '',
  ].some((value) => value.toLocaleLowerCase('vi').includes(needle)));
}
