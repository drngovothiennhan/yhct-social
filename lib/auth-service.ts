'use client';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';
import { buildNewUserProfile } from '@/lib/domain/profile';
import type { AccountType, UserProfile } from '@/lib/types';

export interface RegisterInput {
  displayName: string;
  email: string;
  password: string;
  accountType: Extract<AccountType, 'member' | 'practitioner'>;
}

function userDoc(uid: string) {
  return doc(db, 'users', uid);
}

export async function loadUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(userDoc(uid));
  if (!snapshot.exists()) return null;

  return {
    uid: snapshot.id,
    ...(snapshot.data() as Omit<UserProfile, 'uid'>),
  };
}

export async function createUserProfile(
  user: User,
  displayName: string,
  accountType: Extract<AccountType, 'member' | 'practitioner'>,
): Promise<UserProfile> {
  const existing = await loadUserProfile(user.uid);
  if (existing) return existing;

  const profile = buildNewUserProfile({
    uid: user.uid,
    displayName,
    photoURL: user.photoURL ?? '',
    accountType,
  });

  await setDoc(userDoc(user.uid), {
    ...profile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const created = await loadUserProfile(user.uid);
  if (!created) {
    throw new Error('Không thể tải hồ sơ vừa khởi tạo.');
  }

  return created;
}

export async function registerWithEmail(input: RegisterInput): Promise<UserProfile> {
  const displayName = input.displayName.trim();
  const email = input.email.trim().toLowerCase();

  if (input.password.length < 8) {
    throw new Error('Mật khẩu phải có ít nhất 8 ký tự.');
  }

  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    input.password,
  );

  await updateProfile(credential.user, { displayName });

  return createUserProfile(
    credential.user,
    displayName,
    input.accountType,
  );
}

export async function loginWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
}

export async function loginWithGoogle(): Promise<void> {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    const code = getFirebaseErrorCode(error);
    if (code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    throw error;
  }
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

export function getFirebaseErrorCode(error: unknown): string {
  if (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }
  return '';
}

export function friendlyAuthError(error: unknown): string {
  const code = getFirebaseErrorCode(error);

  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'Email này đã được đăng ký.',
    'auth/invalid-email': 'Địa chỉ email không hợp lệ.',
    'auth/invalid-credential': 'Email hoặc mật khẩu không chính xác.',
    'auth/weak-password': 'Mật khẩu chưa đủ mạnh.',
    'auth/popup-closed-by-user': 'Cửa sổ đăng nhập Google đã được đóng.',
    'auth/cancelled-popup-request': 'Yêu cầu đăng nhập Google đã bị hủy.',
    'auth/too-many-requests': 'Có quá nhiều lần thử. Vui lòng thử lại sau.',
    'auth/network-request-failed': 'Không thể kết nối Firebase. Kiểm tra mạng và thử lại.',
  };

  if (code && messages[code]) return messages[code];
  if (error instanceof Error && error.message) return error.message;
  return 'Đã xảy ra lỗi xác thực. Vui lòng thử lại.';
}
