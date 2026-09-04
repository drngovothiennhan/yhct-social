import type { Timestamp } from 'firebase/firestore';
import type { ClubRole } from '@/lib/domain/rbac';

export type AccountType = 'member' | 'practitioner' | 'student' | 'patient';
export type UserRole = ClubRole | 'moderator';
export type VerificationStatus =
  | 'not_required'
  | 'unsubmitted'
  | 'pending'
  | 'verified'
  | 'rejected';
export type PostType = 'clinical_case' | 'remedy' | 'qa';
export type PostStatus = 'published' | 'hidden' | 'removed';
export type CommentStatus = 'active' | 'hidden' | 'deleted';

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  bio: string;
  specialties: string[];
  accountType: AccountType;
  role: UserRole;
  verificationStatus: VerificationStatus;
  professionalTitle: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface PostRecord {
  id: string;
  authorId: string;
  authorDisplayName: string;
  authorPhotoURL: string;
  authorProfessionalTitle: string;
  professionalLabel: boolean;
  type: PostType;
  title: string;
  content: string;
  mediaPaths: string[];
  tags: string[];
  isDeidentified: boolean;
  status: PostStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface CommentRecord {
  id: string;
  postId: string;
  authorId: string;
  authorDisplayName: string;
  authorPhotoURL: string;
  parentId: string;
  depth: number;
  content: string;
  status: CommentStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}
